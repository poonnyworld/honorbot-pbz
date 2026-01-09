import { Message, Events } from 'discord.js';
import { User } from '../models/User';

export const name = Events.MessageCreate;

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
        lastDailyReset: new Date(),
      });
    } else {
      // Update username in case it changed
      if (user.username !== message.author.username) {
        user.username = message.author.username;
        await user.save();
      }
    }

    // Cooldown Logic: Check if lastMessageDate was less than 60 seconds ago
    const now = new Date();
    const timeSinceLastMessage = (now.getTime() - user.lastMessageDate.getTime()) / 1000; // Convert to seconds

    if (timeSinceLastMessage < 60) {
      return; // Cooldown not passed, no points awarded
    }

    // Add Points: Random 1-5 points to honorPoints
    const pointsToAdd = Math.floor(Math.random() * 5) + 1; // Random number between 1 and 5
    user.honorPoints += pointsToAdd;
    user.lastMessageDate = now;
    await user.save();

    // Console Log
    console.log(
      `[Points] User ${user.username} (${message.author.id}) gained ${pointsToAdd} points. Total: ${user.honorPoints}`
    );
  } catch (error) {
    console.error('Error processing message for honor points:', error);
  }
}
