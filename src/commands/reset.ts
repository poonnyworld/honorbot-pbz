import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { User } from '../models/User';
import mongoose from 'mongoose';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset database - WARNING: This will delete ALL user data! (Administrator only)')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('database')
      .setDescription('⚠️ Reset the entire database (requires confirmation)')
  );

// Store pending resets: userId -> timestamp
const pendingResets = new Map<string, number>();
const RESET_TIMEOUT = 30000; // 30 seconds

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has Administrator permission
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to use this command.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'database') {
    await handleDatabaseReset(interaction);
  }
}

async function handleDatabaseReset(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const now = Date.now();

  // Check if user has a pending reset
  const pendingTimestamp = pendingResets.get(userId);
  
  if (pendingTimestamp && (now - pendingTimestamp) < RESET_TIMEOUT) {
    // Second confirmation - proceed with reset
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get user count before deletion
      const userCount = await User.countDocuments();

      // Delete all users
      const result = await User.deleteMany({});

      // Clear the pending reset
      pendingResets.delete(userId);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('✅ Database Reset Complete')
        .setDescription(
          `**${result.deletedCount}** user(s) have been permanently deleted from the database.\n\n` +
          `⚠️ **This action cannot be undone!**\n\n` +
          `If you had a backup, use \`/backup import\` to restore your data.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      console.log(`[Reset] Database reset completed by ${interaction.user.tag} (${interaction.user.id}). Deleted ${result.deletedCount} users.`);
    } catch (error) {
      console.error('[Reset] Error resetting database:', error);
      pendingResets.delete(userId);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Reset Failed')
        .setDescription('An error occurred while resetting the database. Please check the console for details.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } else {
    // First confirmation - show warning and confirmation button
    await interaction.deferReply({ ephemeral: true });

    // Store pending reset with timestamp
    pendingResets.set(userId, now);

    // Get current user count
    const userCount = await User.countDocuments();

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ CONFIRM DATABASE RESET')
      .setDescription(
        `**WARNING: This will permanently delete ALL user data!**\n\n` +
        `📊 Current database: **${userCount}** user(s)\n\n` +
        `⚠️ **This action cannot be undone!**\n\n` +
        `Click the button below within 30 seconds to confirm the reset.\n` +
        `If you want to keep your data, simply ignore this message.`
      )
      .setFooter({
        text: 'This is a 2-step confirmation to prevent accidental resets',
      })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`reset_confirm_${userId}`)
      .setLabel('⚠️ CONFIRM RESET')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️');

    const cancelButton = new ButtonBuilder()
      .setCustomId(`reset_cancel_${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    await interaction.editReply({ embeds: [embed], components: [row] });

    // Set timeout to clear pending reset
    setTimeout(() => {
      if (pendingResets.get(userId) === now) {
        pendingResets.delete(userId);
      }
    }, RESET_TIMEOUT);

    console.log(`[Reset] Database reset initiated by ${interaction.user.tag} (${interaction.user.id}). Awaiting confirmation...`);
  }
}

/**
 * Handle reset confirmation button
 */
export async function handleResetButton(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  if (customId.startsWith('reset_confirm_')) {
    const buttonUserId = customId.replace('reset_confirm_', '');
    
    if (buttonUserId !== userId) {
      await interaction.reply({
        content: '❌ This confirmation is for a different user.',
        ephemeral: true,
      });
      return;
    }

    const pendingTimestamp = pendingResets.get(userId);
    if (!pendingTimestamp || (Date.now() - pendingTimestamp) >= RESET_TIMEOUT) {
      await interaction.reply({
        content: '❌ Confirmation expired. Please run `/reset database` again.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get user count before deletion
      const userCount = await User.countDocuments();

      // Delete all users
      const result = await User.deleteMany({});

      // Clear the pending reset
      pendingResets.delete(userId);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('✅ Database Reset Complete')
        .setDescription(
          `**${result.deletedCount}** user(s) have been permanently deleted from the database.\n\n` +
          `⚠️ **This action cannot be undone!**\n\n` +
          `If you had a backup, use \`/backup import\` to restore your data.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Update the original message to show it was confirmed
      try {
        await interaction.message.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('✅ Database Reset Confirmed')
              .setDescription('The database reset has been completed.')
              .setTimestamp(),
          ],
          components: [],
        });
      } catch (editError) {
        // Ignore edit errors
      }

      console.log(`[Reset] Database reset completed by ${interaction.user.tag} (${interaction.user.id}). Deleted ${result.deletedCount} users.`);
    } catch (error) {
      console.error('[Reset] Error resetting database:', error);
      pendingResets.delete(userId);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Reset Failed')
        .setDescription('An error occurred while resetting the database. Please check the console for details.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } else if (customId.startsWith('reset_cancel_')) {
    const buttonUserId = customId.replace('reset_cancel_', '');
    
    if (buttonUserId !== userId) {
      await interaction.reply({
        content: '❌ This cancellation is for a different user.',
        ephemeral: true,
      });
      return;
    }

    pendingResets.delete(userId);

    await interaction.reply({
      content: '✅ Database reset cancelled.',
      ephemeral: true,
    });

    // Update the original message
    try {
      await interaction.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Database Reset Cancelled')
            .setDescription('The database reset has been cancelled. No data was deleted.')
            .setTimestamp(),
        ],
        components: [],
      });
    } catch (editError) {
      // Ignore edit errors
    }

    console.log(`[Reset] Database reset cancelled by ${interaction.user.tag} (${interaction.user.id}).`);
  }
}
