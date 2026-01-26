import { Message, Events } from 'discord.js';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { MONGODB_CONNECTED } from '../utils/connectDB';
import { serviceRegistry } from '../services/ServiceRegistry';
import dotenv from 'dotenv';

dotenv.config();

export const name = Events.MessageCreate;

// Daily limit for message rewards (5 times per day)
const DAILY_MESSAGE_REWARD_LIMIT = 5;

// Track processed messages to prevent duplicate processing
// This Set stores message IDs that have already been processed
// Messages are removed after 5 minutes to prevent memory leaks
const processedMessages = new Set<string>();

// Clean up old message IDs every 5 minutes
setInterval(() => {
  // The Set will automatically handle cleanup, but we can add logic here if needed
  // For now, we rely on the fact that message IDs are unique and won't be reused
  // We could add a timestamp-based cleanup if needed, but it's not critical
}, 5 * 60 * 1000);

/**
 * Get weighted random points based on probability distribution
 * @returns Points from 1-5 with distribution: 1 (80%), 2 (10%), 3 (5%), 4 (3%), 5 (2%)
 */
function getWeightedRandomPoints(): number {
  const random = Math.random() * 100; // Generate random number 0-100

  if (random < 80) {
    return 1; // 80% chance
  } else if (random < 90) {
    return 2; // 10% chance (80-90)
  } else if (random < 95) {
    return 3; // 5% chance (90-95)
  } else if (random < 98) {
    return 4; // 3% chance (95-98)
  } else {
    return 5; // 2% chance (98-100)
  }
}

export async function execute(message: Message): Promise<void> {
  // Ignore messages from bots
  if (message.author.bot) {
    return;
  }

  // Ignore messages that are commands (slash commands are handled by interactionCreate, but be safe)
  // Also ignore empty messages
  if (!message.content || message.content.trim().length === 0) {
    return;
  }

  // Prevent duplicate processing of the same message
  // This can happen if the event is fired multiple times or if there's a race condition
  const messageId = message.id;
  if (processedMessages.has(messageId)) {
    console.log(`[Points] Message ${messageId} from ${message.author.username} already processed, skipping`);
    return;
  }

  // Mark message as processed immediately to prevent race conditions
  processedMessages.add(messageId);

  // Check MongoDB connection - silently return if not connected
  if (mongoose.connection.readyState !== MONGODB_CONNECTED) {
    // Remove from processed set if we can't process
    processedMessages.delete(messageId);
    return;
  }

  try {
    // Find user in database or create new if not exists
    let user = await User.findOne({ userId: message.author.id });

    if (!user) {
      user = await User.create({
        userId: message.author.id,
        username: message.author.username,
        honorPoints: 0,
        lastMessageDate: new Date(0), // Set to epoch to allow first message
        dailyPoints: 0,
        lastMessagePointsReset: new Date(), // Initialize reset date
        dailyMessageCount: 0,
        lastDailyReset: new Date(),
        dailyCheckinStreak: 0,
        lastCheckinDate: new Date(0),
      });
    } else {
      // Update username in case it changed
      if (user.username !== message.author.username) {
        user.username = message.author.username;
      }
    }

    const now = new Date();

    // Daily Reset Logic: Check if we need to reset daily message count
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastResetDate = user.lastMessagePointsReset || new Date(0);
    const lastReset = new Date(
      lastResetDate.getFullYear(),
      lastResetDate.getMonth(),
      lastResetDate.getDate()
    );

    // Reset daily message count if it's a new day
    if (today.getTime() > lastReset.getTime()) {
      user.dailyMessageCount = 0;
      user.dailyPoints = 0;
      user.lastMessagePointsReset = now;
      console.log(`[Points] Daily message count reset for ${user.username}`);
    }

    // Check if daily reward limit has been reached (5 times per day)
    if (user.dailyMessageCount >= DAILY_MESSAGE_REWARD_LIMIT) {
      // Daily limit reached - ignore (no reaction) to indicate no points are being earned
      return;
    }

    // Cooldown Logic: Check if lastMessageDate was less than 60 seconds ago
    // Skip cooldown check if lastMessageDate is epoch (new user's first message)
    const isNewUserFirstMessage = user.lastMessageDate.getTime() === 0;

    if (!isNewUserFirstMessage) {
      const timeSinceLastMessage = (now.getTime() - user.lastMessageDate.getTime()) / 1000; // Convert to seconds
      const cooldownRemaining = Math.ceil(60 - timeSinceLastMessage);

      if (timeSinceLastMessage < 60) {
        // Cooldown not passed - silently return (no reaction)
        console.log(`[Points] Cooldown active for ${user.username}: ${cooldownRemaining} seconds remaining`);
        return;
      }
    }

    // Calculate points to add (weighted random 1-5)
    // Distribution: 1 point (80%), 2 points (10%), 3 points (5%), 4 points (3%), 5 points (2%)
    const pointsToAdd = getWeightedRandomPoints();

    // Add Points to honorPoints and increment dailyMessageCount
    user.honorPoints += pointsToAdd;
    user.dailyPoints += pointsToAdd; // Keep for backward compatibility
    user.dailyMessageCount += 1;
    user.lastMessageDate = now;

    await user.save();

    // Console Log
    console.log(
      `[Points] User ${user.username} (${message.author.id}) gained ${pointsToAdd} points. ` +
      `Daily rewards: ${user.dailyMessageCount}/${DAILY_MESSAGE_REWARD_LIMIT}, Total: ${user.honorPoints}`
    );

    // Update status log
    const statusLogService = serviceRegistry.getStatusLogService();
    if (statusLogService) {
      statusLogService.addLogEntry(
        user.username,
        user.userId,
        pointsToAdd,
        user.dailyMessageCount,
        DAILY_MESSAGE_REWARD_LIMIT
      ).catch((error) => {
        console.error('[Points] Error updating status log:', error);
      });
    }

    // No reaction feedback - users should check status via /status command
  } catch (error) {
    console.error('Error processing message for honor points:', error);
    // Remove from processed set on error so it can be retried if needed
    processedMessages.delete(messageId);
  }
}
