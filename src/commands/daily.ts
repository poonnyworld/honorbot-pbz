import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { User } from '../models/User';

/**
 * Get weighted random points for daily check-in (1-10)
 * Distribution favors lower points:
 * 1 point (30%), 2 points (20%), 3 points (15%), 4 points (12%), 5 points (10%),
 * 6 points (6%), 7 points (4%), 8 points (2%), 9 points (0.5%), 10 points (0.5%)
 * @returns Points from 1-10 with weighted probability
 */
function getWeightedRandomDailyPoints(): number {
  const random = Math.random() * 100; // Generate random number 0-100
  
  if (random < 30) {
    return 1; // 30% chance
  } else if (random < 50) {
    return 2; // 20% chance (30-50)
  } else if (random < 65) {
    return 3; // 15% chance (50-65)
  } else if (random < 77) {
    return 4; // 12% chance (65-77)
  } else if (random < 87) {
    return 5; // 10% chance (77-87)
  } else if (random < 93) {
    return 6; // 6% chance (87-93)
  } else if (random < 97) {
    return 7; // 4% chance (93-97)
  } else if (random < 99) {
    return 8; // 2% chance (97-99)
  } else if (random < 99.5) {
    return 9; // 0.5% chance (99-99.5)
  } else {
    return 10; // 0.5% chance (99.5-100)
  }
}

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily honor points meditation reward');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {

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
        dailyMessageCount: 0,
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

    // Check if already claimed today (compare dates without time, using UTC to avoid timezone issues)
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Handle case where lastDailyReset might be null, invalid, or epoch (new users)
    let lastResetDate: Date;
    if (!user.lastDailyReset || user.lastDailyReset.getTime() === 0) {
      // New user or reset to epoch - allow claim
      lastResetDate = new Date(0);
    } else {
      lastResetDate = new Date(user.lastDailyReset);
    }

    const lastReset = new Date(Date.UTC(
      lastResetDate.getUTCFullYear(),
      lastResetDate.getUTCMonth(),
      lastResetDate.getUTCDate()
    ));

    // Only block if lastDailyReset is today (and not epoch)
    if (user.lastDailyReset && user.lastDailyReset.getTime() !== 0 && today.getTime() === lastReset.getTime()) {
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

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Generate weighted random honor points between 1 and 10
    // Lower points have higher probability, higher points have lower probability
    const pointsGained = getWeightedRandomDailyPoints();

    // Update user
    user.honorPoints += pointsGained;
    user.lastDailyReset = now;
    await user.save();

    // Create embed response
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🧘 Daily Meditation Complete')
      .setDescription(
        `**${interaction.user.username}**, your cultivation session has ended.\n\n` +
        `**Honor Points Gained:** ${pointsGained} ⚔️\n\n` +
        `**Total Honor Points:** ${user.honorPoints} 🏆`
      )
      .setFooter({
        text: 'Return tomorrow to claim your daily reward!',
      })
      .setTimestamp();

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
