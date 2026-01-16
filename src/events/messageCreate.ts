import { Message, Events } from 'discord.js';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

export const name = Events.MessageCreate;

// Daily limit for message rewards (5 times per day)
const DAILY_MESSAGE_REWARD_LIMIT = 5;

export async function execute(message: Message): Promise<void> {
  // Ignore messages from bots
  if (message.author.bot) {
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
      // Daily limit reached, no points awarded
      return;
    }

    // Cooldown Logic: Check if lastMessageDate was less than 60 seconds ago
    const timeSinceLastMessage = (now.getTime() - user.lastMessageDate.getTime()) / 1000; // Convert to seconds

    if (timeSinceLastMessage < 60) {
      return; // Cooldown not passed, no points awarded
    }

    // Calculate points to add (random 1-5)
    const pointsToAdd = Math.floor(Math.random() * 5) + 1;

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
  } catch (error) {
    console.error('Error processing message for honor points:', error);
  }
}
