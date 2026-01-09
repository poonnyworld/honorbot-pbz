import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { User } from '../models/User';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily honor points meditation reward');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Feature Flag: Read ENABLE_STREAK from environment (defaults to true if not set)
    // Parse as boolean (handles 'false', 'true', '0', '1', etc.)
    const enableStreak = process.env.ENABLE_STREAK === undefined || process.env.ENABLE_STREAK?.toLowerCase() === 'true';

    // Fetch or create user from DB
    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      user = await User.create({
        userId: interaction.user.id,
        username: interaction.user.username,
        honorPoints: 0,
        lastMessageDate: new Date(),
        dailyPoints: 0,
        lastMessagePointsReset: new Date(),
        lastDailyReset: new Date(0), // Set to epoch to allow first daily
        dailyCheckinStreak: 0,
        lastCheckinDate: new Date(0), // Set to epoch
      });
    } else {
      // Update username in case it changed
      if (user.username !== interaction.user.username) {
        user.username = interaction.user.username;
      }
    }

    const now = new Date();
    const lastResetDate = new Date(user.lastDailyReset);
    
    // Check if already claimed today (compare dates without time)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastReset = new Date(
      lastResetDate.getFullYear(),
      lastResetDate.getMonth(),
      lastResetDate.getDate()
    );

    if (today.getTime() === lastReset.getTime()) {
      // Already claimed today, calculate next reset time (tomorrow at midnight)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextResetTimestamp = Math.floor(tomorrow.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('⏳ Daily Meditation Already Completed')
        .setDescription(
          `You have already claimed your daily reward today. Come back <t:${nextResetTimestamp}:R> to continue your cultivation journey!`
        )
        .setTimestamp();

      // Only show streak in footer if streak system is enabled
      if (enableStreak) {
        embed.setFooter({
          text: `Current Streak: ${user.dailyCheckinStreak} days`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const basePoints = 100;
    let pointsGained = basePoints;
    let streak = user.dailyCheckinStreak || 0;
    let multiplier = 1.0;

    // Streak Logic (only if enabled)
    if (enableStreak) {
      // Check streak logic
      const lastCheckin = new Date(user.lastCheckinDate);
      const lastCheckinDay = new Date(
        lastCheckin.getFullYear(),
        lastCheckin.getMonth(),
        lastCheckin.getDate()
      );
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastCheckinDay.getTime() === yesterday.getTime()) {
        // Continuous streak - increment
        streak += 1;
      } else if (lastCheckinDay.getTime() < yesterday.getTime()) {
        // Missed days - reset to 1
        streak = 1;
      } else {
        // First time or same day (shouldn't happen, but safety)
        if (streak === 0) {
          streak = 1;
        }
      }

      // Calculate points with multiplier
      multiplier = Math.min(1 + streak * 0.1, 2.0); // Max 2x multiplier
      pointsGained = Math.floor(basePoints * multiplier);

      // Update streak fields
      user.dailyCheckinStreak = streak;
      user.lastCheckinDate = now;
    } else {
      // Streak disabled: Just give base points, no multiplier
      // Still update lastCheckinDate to prevent double claiming
      user.lastCheckinDate = now;
      // Keep existing streak value (don't reset it, in case we re-enable later)
    }

    // Update user (always update these fields)
    user.honorPoints += pointsGained;
    user.lastDailyReset = now;
    await user.save();

    // Create embed response
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🧘 Daily Meditation Complete')
      .setTimestamp();

    if (enableStreak) {
      // Full embed with streak information
      embed.setDescription(
        `**${interaction.user.username}**, your cultivation session has ended.\n\n` +
          `**Honor Points Gained:** ${pointsGained} ⚔️\n` +
          `**Base Points:** ${basePoints}\n` +
          `**Streak Multiplier:** ${(multiplier * 100).toFixed(0)}% (${streak} day${streak !== 1 ? 's' : ''})\n\n` +
          `**Current Streak:** ${streak} day${streak !== 1 ? 's' : ''} 🔥\n` +
          `**Total Honor Points:** ${user.honorPoints} 🏆`
      )
      .setFooter({
        text: 'Continue your daily practice to increase your streak bonus!',
      });
    } else {
      // Simplified embed without streak information
      embed.setDescription(
        `**${interaction.user.username}**, your cultivation session has ended.\n\n` +
          `**Honor Points Gained:** ${pointsGained} ⚔️\n\n` +
          `**Total Honor Points:** ${user.honorPoints} 🏆`
      )
      .setFooter({
        text: 'Return tomorrow to claim your daily reward!',
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error processing daily command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while processing your daily check-in. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
