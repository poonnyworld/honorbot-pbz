import { Events, Interaction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import * as dailyCommand from '../commands/daily';
import * as profileCommand from '../commands/profile';
import * as helpCommand from '../commands/help';
import * as leaderboardCommand from '../commands/leaderboard';
import * as backupCommand from '../commands/backup';
import * as resetCommand from '../commands/reset';
import * as statusCommand from '../commands/status';
import { User } from '../models/User';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  // Handle button interactions first
  if (interaction.isButton()) {
    if (interaction.customId === 'daily_claim_button') {
      await handleDailyButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('reset_confirm_') || interaction.customId.startsWith('reset_cancel_')) {
      await resetCommand.handleResetButton(interaction);
      return;
    }
  }

  // Handle slash commands
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;
  console.log(`[InteractionCreate] Received command: ${commandName} from ${interaction.user.tag}`);

  // Handle slash commands
  try {
    switch (commandName) {
      case 'daily':
        await dailyCommand.execute(interaction);
        break;
      case 'profile':
        await profileCommand.execute(interaction);
        break;
      case 'help':
        await helpCommand.execute(interaction);
        break;
      case 'leaderboard':
        await leaderboardCommand.execute(interaction);
        break;
      case 'backup':
        await backupCommand.execute(interaction);
        break;
      case 'reset':
        await resetCommand.execute(interaction);
        break;
      case 'status':
        await statusCommand.execute(interaction);
        break;
      default:
        console.warn(`[InteractionCreate] Unknown command: ${commandName}`);
    }
  } catch (error) {
    console.error(`[InteractionCreate] Error executing command ${commandName}:`, error);
    if (error instanceof Error) {
      console.error(`[InteractionCreate] Error message: ${error.message}`);
      console.error(`[InteractionCreate] Error stack: ${error.stack}`);
    }

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error(`[InteractionCreate] Could not send error reply:`, replyError);
    }
  }
}

/**
 * Handle the daily claim button interaction
 */
async function handleDailyButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

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
          `You have already claimed your daily reward today. Please come back tomorrow.`
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
    console.error('Error processing daily button:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while processing your daily check-in. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

