import * as cron from 'node-cron';
import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import { BackupService } from './BackupService';

export class BackupSchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private client: Client | null = null;

  public start(client: Client): void {
    this.client = client;
    const channelId = process.env.BACKUP_DATABASE_CHANNEL_ID;

    if (!channelId || !/^\d{17,19}$/.test(channelId)) {
      console.warn('[BackupScheduler] BACKUP_DATABASE_CHANNEL_ID not set or invalid. Scheduled backup disabled.');
      return;
    }

    // เที่ยงคืนและเที่ยงวันเวลาไทย (cron เดียว ประหยัดแรม)
    this.cronJob = cron.schedule(
      '0 0,12 * * *',
      () => {
        this.runScheduledBackup();
      },
      { timezone: 'Asia/Bangkok' }
    );

    console.log('[BackupScheduler] Started. Backup 00:00 & 12:00 (Asia/Bangkok) → channel', channelId);
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.client = null;
    console.log('[BackupScheduler] Stopped.');
  }

  public runScheduledBackup(): void {
    const channelId = process.env.BACKUP_DATABASE_CHANNEL_ID;
    const client = this.client;
    if (!client || !channelId) return;

    console.log('[BackupScheduler] ⏰ Running scheduled database backup...');
    BackupService.exportDatabase()
      .then((jsonData) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `phantom_backup_${timestamp}.json`;
        return client.channels.fetch(channelId).then((ch) => ({ ch, jsonData, filename }));
      })
      .then(({ ch, jsonData, filename }) => {
        if (!ch?.isTextBased()) {
          console.error('[BackupScheduler] Channel not found or not text channel:', channelId);
          return;
        }
        const attachment = new AttachmentBuilder(Buffer.from(jsonData, 'utf-8'), { name: filename });
        return (ch as TextChannel).send({
          content: `📦 **Scheduled Database Backup**\n\`${filename}\`\n*00:00 & 12:00 น. (ไทย)*`,
          files: [attachment],
        });
      })
      .then(() => console.log('[BackupScheduler] ✓ Backup sent to channel', channelId))
      .catch((err) => console.error('[BackupScheduler] ❌ Scheduled backup failed:', err));
  }
}
