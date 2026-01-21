import { Message, Events } from 'discord.js';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { MONGODB_CONNECTED } from '../utils/connectDB';
import dotenv from 'dotenv';

dotenv.config();

export const name = Events.MessageCreate;

// Daily limit for message rewards (5 times per day)
const DAILY_MESSAGE_REWARD_LIMIT = 5;

// Number emoji mapping for points (1-5)
const POINT_EMOJIS: Record<number, string> = {
  1: '1️⃣',
  2: '2️⃣',
  3: '3️⃣',
  4: '4️⃣',
  5: '5️⃣',
};

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

  // Check MongoDB connection - silently return if not connected
  if (mongoose.connection.readyState !== MONGODB_CONNECTED) {
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
        // Cooldown not passed, react with ⏳
        console.log(`[Points] Cooldown active for ${user.username}: ${cooldownRemaining} seconds remaining`);
        await sendCooldownReaction(message);
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

    // Send feedback via emoji reaction
    await sendReactionFeedback(message, pointsToAdd, user.dailyMessageCount, DAILY_MESSAGE_REWARD_LIMIT);
  } catch (error) {
    console.error('Error processing message for honor points:', error);
    // Try to send error feedback to user
    try {
      await message.react('❌').catch(() => { });
    } catch (feedbackError) {
      // Ignore feedback errors
    }
  }
}

/**
 * Send feedback via emoji reaction for cooldown scenarios
 * @param message - The message to react to
 */
async function sendCooldownReaction(message: Message): Promise<void> {
  try {
    // Try to use custom Discord emoji if available, otherwise use Unicode
    let hourglassEmoji = '⏳'; // Unicode hourglass flowing sand emoji

    // Try to get custom emoji from guild if message is from a guild
    if (message.guild) {
      try {
        const customEmoji = message.guild.emojis.cache.find(
          (emoji: { name: string | null }) => emoji.name === 'hourglass_flowing_sand'
        );
        if (customEmoji) {
          hourglassEmoji = customEmoji.toString();
        }
      } catch (emojiError) {
        // If we can't find custom emoji, fall back to Unicode
        console.log('[Points] Custom hourglass emoji not found, using Unicode');
      }
    }

    await message.react(hourglassEmoji);
    console.log(`[Points] Cooldown active - reacted with ${hourglassEmoji} to message from ${message.author.username}`);
  } catch (error) {
    // If reaction fails, log the error details
    console.error(`[Points] Error reacting to message from ${message.author.username} (cooldown):`, error);
    if (error instanceof Error) {
      console.error(`[Points] Error message: ${error.message}`);
      console.error(`[Points] Error stack: ${error.stack}`);
    }
  }
}

/**
 * Send feedback via emoji reaction instead of text message
 * @param message - The message to react to
 * @param pointsEarned - Points earned (1-5)
 * @param dailyMessageCount - Current daily message count
 * @param limit - Daily limit (usually 5)
 */
async function sendReactionFeedback(
  message: Message,
  pointsEarned: number,
  dailyMessageCount: number,
  limit: number
): Promise<void> {
  try {
    // React with number emoji corresponding to points earned (1️⃣-5️⃣)
    const emoji = POINT_EMOJIS[pointsEarned];

    if (emoji) {
      await message.react(emoji);
      console.log(`[Points] Reacted with ${emoji} to message from ${message.author.username} (${pointsEarned} points)`);
    } else {
      // Fallback: use a generic coin emoji if number is out of range
      await message.react('🪙');
      console.log(`[Points] Reacted with 🪙 to message from ${message.author.username} (${pointsEarned} points, out of range)`);
    }

    // React with ✅ or 🌟 on the exact message that hits the limit (5th message)
    if (dailyMessageCount === limit) {
      try {
        await message.react('✅');
        console.log(`[Points] Daily limit reached - reacted with ✅ to ${message.author.username}'s ${dailyMessageCount}th message`);
      } catch (checkmarkError) {
        // Ignore if we can't add a second reaction (e.g., rate limit)
        console.log('[Points] Could not add checkmark reaction (may be rate limited)');
      }
    }
  } catch (error) {
    // If reaction fails, log but don't fail the whole operation
    console.warn(`[Points] Could not react to message from ${message.author.username}:`, error);
  }
}
