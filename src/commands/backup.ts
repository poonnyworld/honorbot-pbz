import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { BackupService } from '../services/BackupService';
import { serviceRegistry } from '../services/ServiceRegistry';

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Backup or restore database (Administrator only)')
  // Note: We check permissions in execute() to allow visibility but enforce admin requirement
  .addSubcommand((subcommand) =>
    subcommand
      .setName('export')
      .setDescription('Export database to JSON → ส่งลงช่อง backup (หรือ DM ถ้าไม่ได้ตั้งช่อง)')
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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('export-monthly')
      .setDescription('Send last month\'s Top 10 leaderboard to BACKUP_LEADERBOARD_CHANNEL_ID (Bangkok time)')
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

      // Export database (always reads latest from MongoDB — same source as leaderboard)
      const { jsonData, count } = await BackupService.exportDatabase();

      // Create file buffer
      const buffer = Buffer.from(jsonData, 'utf-8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `phantom_backup_${timestamp}.json`;

      // Create attachment
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      const backupChannelId = (process.env.BACKUP_DATABASE_CHANNEL_ID ?? '').trim();

      if (!backupChannelId || !/^\d{17,19}$/.test(backupChannelId)) {
        console.log('[Backup] BACKUP_DATABASE_CHANNEL_ID not set or invalid, using DM');
      }

      // ส่งลงช่อง backup ก่อน (ถ้ามี) ไม่ส่ง DM
      if (backupChannelId && /^\d{17,19}$/.test(backupChannelId)) {
        try {
          const channel = await interaction.client.channels.fetch(backupChannelId);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              content: `📦 **Database Backup** (requested by ${interaction.user.tag})\n\`${filename}\`\n📊 **ข้อมูลล่าสุดจาก DB ตอน export:** ${count} users\n*Keep this file secure!*`,
              files: [attachment],
            });
            await interaction.editReply({
              content: `✅ ส่ง backup ไปที่ <#${backupChannelId}> แล้ว (${count} users)`,
            });
            console.log('[Backup] Export sent to channel', backupChannelId, 'by', interaction.user.tag);
            return;
          }
          console.warn('[Backup] Channel', backupChannelId, 'is not text channel');
        } catch (channelError) {
          const err = channelError instanceof Error ? channelError.message : String(channelError);
          console.warn('[Backup] Failed to send to backup channel, falling back to DM. Error:', err);
        }
      }

      // Fallback: try DM, then ephemeral reply
      try {
        await interaction.user.send({
          content: `📦 **Database Backup**\n\`${filename}\`\n📊 ข้อมูลล่าสุดจาก DB ตอน export: ${count} users\n\nYour database backup file is attached below. Keep this file secure!`,
          files: [attachment],
        });
        await interaction.editReply({
          content: `✅ Database backup exported successfully! (${count} users) Check your DMs for the file.`,
        });
      } catch (dmError) {
        console.warn('[Backup] Failed to send DM, using ephemeral reply instead:', dmError);
        await interaction.editReply({
          content: `✅ Database backup exported successfully! (${count} users)`,
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
    } else if (subcommand === 'export-monthly') {
      const channelId = (process.env.BACKUP_LEADERBOARD_CHANNEL_ID ?? '').trim();
      if (!channelId || !/^\d{17,19}$/.test(channelId)) {
        await interaction.editReply({
          content: '❌ `BACKUP_LEADERBOARD_CHANNEL_ID` is not set or invalid in .env',
        });
        return;
      }
      const leaderboardService = serviceRegistry.getLeaderboardService();
      if (!leaderboardService) {
        await interaction.editReply({
          content: '❌ Leaderboard service is not available.',
        });
        return;
      }
      const ok = await leaderboardService.exportMonthlyLeaderboardNow();
      if (ok) {
        await interaction.editReply({
          content: `✅ ส่งตารางคะแนนรายเดือน (เดือนที่เพิ่งจบ ตามเวลาไทย) ไปที่ <#${channelId}> แล้ว`,
        });
      } else {
        await interaction.editReply({
          content: '❌ ส่งตารางรายเดือนไม่สำเร็จ ดู log ใน console',
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
