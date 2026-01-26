import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { User } from '../models/User';

interface LogEntry {
  timestamp: Date;
  username: string;
  userId: string;
  points: number;
  currentCount: number;
  maxCount: number;
}

export class StatusLogService {
  private logMessageId: string | null = null;
  private client: Client | null = null;
  private logEntries: LogEntry[] = [];
  private readonly MAX_ENTRIES = 10;

  /**
   * Start the status log service
   */
  public start(client: Client): void {
    this.client = client;
    const channelId = process.env.STATUS_CHANNEL_ID;

    console.log('[StatusLogService] Initializing status log service...');
    console.log(`[StatusLogService] STATUS_CHANNEL_ID from env: ${channelId || 'NOT SET'}`);

    if (!channelId) {
      console.warn('[StatusLogService] ⚠️ STATUS_CHANNEL_ID not set. Status log service will not start.');
      console.warn('[StatusLogService] Set STATUS_CHANNEL_ID in your .env file to enable the status log service.');
      return;
    }

    // Validate channel ID is a valid snowflake
    if (!/^\d{17,19}$/.test(channelId)) {
      console.error(`[StatusLogService] ❌ Invalid STATUS_CHANNEL_ID format: "${channelId}"`);
      console.error('[StatusLogService] Must be a valid Discord snowflake (17-19 digit number).');
      return;
    }

    console.log(`[StatusLogService] ✓ Channel ID validated: ${channelId}`);
    console.log('[StatusLogService] Status log service started successfully.');
  }

  /**
   * Stop the status log service
   */
  public stop(): void {
    console.log('[StatusLogService] Stopping status log service...');
    this.client = null;
    this.logMessageId = null;
    this.logEntries = [];
    console.log('[StatusLogService] ✓ Status log service stopped.');
  }

  /**
   * Add a new log entry and update the status log message
   */
  public async addLogEntry(username: string, userId: string, points: number, currentCount: number, maxCount: number): Promise<void> {
    if (!this.client || !this.client.isReady()) {
      console.warn('[StatusLogService] Cannot add log entry: Client not ready yet.');
      return;
    }

    const channelId = process.env.STATUS_CHANNEL_ID;
    if (!channelId) {
      return;
    }

    // Add new entry
    const newEntry: LogEntry = {
      timestamp: new Date(),
      username,
      userId,
      points,
      currentCount,
      maxCount,
    };

    this.logEntries.unshift(newEntry); // Add to beginning

    // Keep only last MAX_ENTRIES entries
    if (this.logEntries.length > this.MAX_ENTRIES) {
      this.logEntries = this.logEntries.slice(0, this.MAX_ENTRIES);
    }

    // Update the message
    await this.updateLogMessage();
  }

  /**
   * Update the status log message in the channel
   */
  private async updateLogMessage(): Promise<void> {
    const channelId = process.env.STATUS_CHANNEL_ID;

    if (!channelId || !this.client || !this.client.isReady()) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        console.error(`[StatusLogService] ❌ Channel ${channelId} not found or not text-based.`);
        return;
      }

      const textChannel = channel as TextChannel;

      // Check permissions
      const botMember = await textChannel.guild.members.fetch(this.client.user!.id);
      const permissions = textChannel.permissionsFor(botMember);

      if (!permissions || !permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
        console.error(`[StatusLogService] ❌ Bot lacks required permissions in status log channel ${channelId}.`);
        return;
      }

      // Generate embed content
      const embed = await this.generateEmbed();

      // Find existing message
      let logMessage: Message | null = null;

      if (this.logMessageId) {
        try {
          const storedMessage = await textChannel.messages.fetch(this.logMessageId);
          if (storedMessage && storedMessage.author.id === this.client.user?.id) {
            logMessage = storedMessage;
            console.log(`[StatusLogService] ✓ Found existing log message: ${this.logMessageId}`);
          } else {
            this.logMessageId = null;
          }
        } catch (fetchError: any) {
          if (fetchError.code === 10008 || fetchError.code === 404) {
            console.log(`[StatusLogService] Stored log message ID ${this.logMessageId} was deleted, clearing...`);
            this.logMessageId = null;
          }
        }
      }

      // If not found, search for it
      if (!logMessage) {
        console.log('[StatusLogService] Searching for existing log message...');
        const messages = await textChannel.messages.fetch({ limit: 50 });

        // Collect all status log messages
        const statusLogMessages: Message[] = [];
        for (const [id, msg] of messages) {
          if (msg.author.id === this.client.user?.id && msg.embeds.length > 0) {
            // Check if this message has our status log embed (by title)
            const hasStatusLogEmbed = msg.embeds.some(embed => 
              embed.title?.includes('Status Log') || embed.title?.includes('Point Distribution')
            );
            if (hasStatusLogEmbed) {
              statusLogMessages.push(msg);
            }
          }
        }

        // Find the latest message (most recent by timestamp)
        if (statusLogMessages.length > 0) {
          // Sort by createdTimestamp (newest first)
          statusLogMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
          logMessage = statusLogMessages[0]; // Get the latest message
          this.logMessageId = logMessage.id;
          console.log(`[StatusLogService] ✓ Found ${statusLogMessages.length} log message(s), using latest: ${logMessage.id}`);

          // Delete old messages if there are more than one
          if (statusLogMessages.length > 1) {
            console.log(`[StatusLogService] Deleting ${statusLogMessages.length - 1} old log message(s)...`);
            for (let i = 1; i < statusLogMessages.length; i++) {
              try {
                await statusLogMessages[i].delete();
                console.log(`[StatusLogService] ✓ Deleted old log message: ${statusLogMessages[i].id}`);
              } catch (deleteError) {
                console.error(`[StatusLogService] ❌ Error deleting old log message ${statusLogMessages[i].id}:`, deleteError);
              }
            }
          }
        }
      }

      if (logMessage) {
        // Edit existing message
        try {
          await logMessage.edit({ embeds: [embed] });
          console.log('[StatusLogService] ✓ Log message updated successfully');
        } catch (error) {
          console.error('[StatusLogService] ❌ Error editing log message:', error);
          this.logMessageId = null;
          logMessage = null;
        }
      }

      if (!logMessage) {
        // Send new message
        try {
          const newMessage = await textChannel.send({ embeds: [embed] });
          this.logMessageId = newMessage.id;
          console.log('[StatusLogService] ✓ Log message sent successfully');
          console.log(`[StatusLogService] Stored log message ID: ${this.logMessageId}`);
        } catch (error) {
          console.error('[StatusLogService] ❌ Error sending log message:', error);
        }
      }
    } catch (error) {
      console.error('[StatusLogService] ❌ Critical error updating log message:', error);
      if (error instanceof Error) {
        console.error('[StatusLogService] Error message:', error.message);
        console.error('[StatusLogService] Error stack:', error.stack);
      }
    }
  }

  /**
   * Generate the status log embed
   */
  private async generateEmbed(): Promise<EmbedBuilder> {
    let description = '';

    if (this.logEntries.length === 0) {
      description = '*No point distributions yet. Point distributions will appear here as users earn points.*';
    } else {
      const now = new Date();
      
      for (const entry of this.logEntries) {
        // Use Discord timestamp format for time display
        const timestamp = Math.floor(entry.timestamp.getTime() / 1000);
        const timeStr = `<t:${timestamp}:T>`;
        
        // Get user's current cooldown status
        let cooldownInfo = '';
        try {
          const user = await User.findOne({ userId: entry.userId });
          if (user) {
            const isNewUserFirstMessage = user.lastMessageDate.getTime() === 0;
            if (!isNewUserFirstMessage) {
              const timeSinceLastMessage = (now.getTime() - user.lastMessageDate.getTime()) / 1000;
              const cooldownRemaining = Math.max(0, Math.ceil(60 - timeSinceLastMessage));
              const isOnCooldown = timeSinceLastMessage < 60;
              
              if (isOnCooldown) {
                // Calculate when cooldown will end (lastMessageDate + 60 seconds)
                const cooldownEndTime = Math.floor((user.lastMessageDate.getTime() + 60000) / 1000);
                cooldownInfo = ` ⏳ (ends <t:${cooldownEndTime}:T>)`;
              } else {
                cooldownInfo = ` ✅ Ready`;
              }
            } else {
              cooldownInfo = ` ✅ Ready`;
            }
          } else {
            // User not found in database
            cooldownInfo = ` ❓ Unknown`;
          }
        } catch (error) {
          // If we can't fetch user data, log error and show unknown
          console.error(`[StatusLogService] Error fetching cooldown for user ${entry.userId}:`, error);
          cooldownInfo = ` ❓ Error`;
        }
        
        description += `${timeStr} **${entry.username}** earned **+${entry.points}** points (Current: ${entry.currentCount}/${entry.maxCount})${cooldownInfo}\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('📊 Status Log - Point Distributions')
      .setDescription(description)
      .setFooter({
        text: `Showing last ${this.logEntries.length} distribution${this.logEntries.length !== 1 ? 's' : ''}`,
      })
      .setTimestamp();

    return embed;
  }
}
