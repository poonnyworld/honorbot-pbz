import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BackupService } from '../services/BackupService';

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Backup or restore database (Administrator only)')
  // Note: We check permissions in execute() to allow visibility but enforce admin requirement
  .addSubcommand((subcommand) =>
    subcommand
      .setName('export')
      .setDescription('Export database to JSON file (sent as DM)')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('import')
      .setDescription('Import database from JSON file attachment')
      .addAttachmentOption((option) =>
        option
          .setName('file')
          .setDescription('JSON backup file to import')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has Administrator permission
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to use this command.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'export') {
      console.log(`[Backup] Export requested by ${interaction.user.tag} (${interaction.user.id})`);

      // Export database
      const jsonData = await BackupService.exportDatabase();

      // Create file buffer
      const buffer = Buffer.from(jsonData, 'utf-8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `phantom_backup_${timestamp}.json`;

      // Create attachment
      const attachment = new AttachmentBuilder(buffer, { name: filename });

      // Try to send as DM first, fallback to ephemeral reply
      try {
        await interaction.user.send({
          content: '📦 **Database Backup**\n\nYour database backup file is attached below. Keep this file secure!',
          files: [attachment],
        });

        await interaction.editReply({
          content: '✅ Database backup exported successfully! Check your DMs for the file.',
        });
      } catch (dmError) {
        // If DM fails (DMs disabled), send as ephemeral reply instead
        console.warn('[Backup] Failed to send DM, using ephemeral reply instead:', dmError);
        await interaction.editReply({
          content: '✅ Database backup exported successfully!',
          files: [attachment],
        });
      }

      console.log(`[Backup] Export completed successfully for ${interaction.user.tag}`);
    } else if (subcommand === 'import') {
      const attachment = interaction.options.getAttachment('file');

      if (!attachment) {
        await interaction.editReply({
          content: '❌ No file attachment provided.',
        });
        return;
      }

      // Validate file type
      if (!attachment.name?.endsWith('.json')) {
        await interaction.editReply({
          content: '❌ Invalid file type. Please upload a .json file.',
        });
        return;
      }

      // Check file size (limit to 10MB)
      if (attachment.size > 10 * 1024 * 1024) {
        await interaction.editReply({
          content: '❌ File too large. Maximum size is 10MB.',
        });
        return;
      }

      console.log(`[Backup] Import requested by ${interaction.user.tag} (${interaction.user.id})`);
      console.log(`[Backup] File: ${attachment.name}, Size: ${attachment.size} bytes`);

      // Fetch file content
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const jsonText = await response.text();

        // Import database
        const result = await BackupService.importDatabase(jsonText);

        await interaction.editReply({
          content: `✅ Database import completed!\n\n` +
            `📥 **Imported:** ${result.imported} users\n` +
            `🔄 **Updated:** ${result.updated} users\n` +
            `❌ **Errors:** ${result.errors} records`,
        });

        console.log(`[Backup] Import completed: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`);
      } catch (fetchError) {
        console.error('[Backup] Error fetching file:', fetchError);
        await interaction.editReply({
          content: '❌ Failed to download the backup file. Please try again.',
        });
      }
    }
  } catch (error) {
    console.error('[Backup] Error executing backup command:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await interaction.editReply({
      content: `❌ Error: ${errorMessage}\n\nPlease check the console for details.`,
    });
  }
}
