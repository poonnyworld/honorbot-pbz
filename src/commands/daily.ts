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

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Generate random honor points between 1 and 10 (equal probability)
    const pointsGained = Math.floor(Math.random() * 10) + 1;

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
