import { Message, Events } from 'discord.js';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { MONGODB_CONNECTED } from '../utils/connectDB';
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
    // Remove from processed set on error so it can be retried if needed
    processedMessages.delete(messageId);
    
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
    // Fetch message reactions to check if we already reacted
    // This prevents duplicate reactions if the function is called multiple times
    let existingReactions;
    try {
      // Try to fetch the message to get fresh reaction data
      // This ensures we have the latest reactions, especially if the message was just created
      const fetchedMessage = await message.fetch();
      existingReactions = fetchedMessage.reactions.cache;
    } catch (fetchError) {
      // If we can't fetch (e.g., message was deleted or permission issue), use cached reactions
      existingReactions = message.reactions.cache;
      console.warn('[Points] Could not fetch message reactions, using cache');
    }

    // React with number emoji corresponding to points earned (1️⃣-5️⃣)
    const emoji = POINT_EMOJIS[pointsEarned];

    if (emoji) {
      // Check if this emoji is already on the message (prevent duplicate reactions)
      // Check both by name and by string representation to catch all cases
      // Also check if our bot already reacted to this message
      let alreadyReacted = false;
      let ourBotReacted = false;

      if (existingReactions) {
        for (const reaction of existingReactions.values()) {
          const reactionEmoji = reaction.emoji.name || reaction.emoji.toString();
          if (reactionEmoji === emoji || reactionEmoji === emoji.replace(/[^\w\s]/g, '')) {
            alreadyReacted = true;
            // Check if our bot is among the users who reacted
            try {
              const users = await reaction.users.fetch();
              ourBotReacted = users.some(user => user.bot && user.id === message.client.user?.id);
            } catch (fetchError) {
              // If we can't fetch users, assume it might be our reaction
              ourBotReacted = true;
            }
            break;
          }
        }
      }

      if (alreadyReacted && ourBotReacted) {
        console.log(`[Points] Our bot already reacted with ${emoji} to message from ${message.author.username}, skipping`);
      } else if (alreadyReacted && !ourBotReacted) {
        // Another bot/user reacted with the same emoji, but not us - we should still react
        console.log(`[Points] Emoji ${emoji} exists on message but not from our bot, adding our reaction`);
        try {
          await message.react(emoji);
          console.log(`[Points] Reacted with ${emoji} to message from ${message.author.username} (${pointsEarned} points)`);
        } catch (reactError) {
          console.warn(`[Points] Failed to react with ${emoji} to message from ${message.author.username}:`, reactError);
        }
      } else {
        // No reaction exists, add ours
        try {
          await message.react(emoji);
          console.log(`[Points] Reacted with ${emoji} to message from ${message.author.username} (${pointsEarned} points)`);
        } catch (reactError) {
          // If reaction fails (e.g., already exists, rate limit), log but don't fail
          console.warn(`[Points] Failed to react with ${emoji} to message from ${message.author.username}:`, reactError);
        }
      }
    } else {
      // Fallback: use a generic coin emoji if number is out of range
      const alreadyReacted = existingReactions?.some(reaction => 
        reaction.emoji.name === '🪙' || reaction.emoji.toString() === '🪙'
      );

      if (!alreadyReacted) {
        await message.react('🪙');
        console.log(`[Points] Reacted with 🪙 to message from ${message.author.username} (${pointsEarned} points, out of range)`);
      }
    }

    // React with ✅ on the exact message that hits the limit (5th message)
    if (dailyMessageCount === limit) {
      try {
        // Check if ✅ is already on the message
        const alreadyHasCheckmark = existingReactions?.some(reaction => 
          reaction.emoji.name === '✅' || reaction.emoji.toString() === '✅'
        );

        if (!alreadyHasCheckmark) {
          await message.react('✅');
          console.log(`[Points] Daily limit reached - reacted with ✅ to ${message.author.username}'s ${dailyMessageCount}th message`);
        } else {
          console.log(`[Points] Checkmark already exists on message from ${message.author.username}, skipping`);
        }
      } catch (checkmarkError) {
        // Ignore if we can't add a second reaction (e.g., rate limit)
        console.log('[Points] Could not add checkmark reaction (may be rate limited)');
      }
    }
  } catch (error) {
    // If reaction fails, log but don't fail the whole operation
    console.warn(`[Points] Could not react to message from ${message.author.username}:`, error);
    if (error instanceof Error) {
      console.warn(`[Points] Error details: ${error.message}`);
    }
  }
}
