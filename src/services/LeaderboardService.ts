import * as cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder, Message, Collection } from 'discord.js';
import { User } from '../models/User';

export class LeaderboardService {
  private cronJob: cron.ScheduledTask | null = null;
  private lastMessageId: string | null = null;
  private client: Client | null = null;

  /**
   * Start the leaderboard service with a cron job that runs every 5 minutes
   */
  public start(client: Client): void {
    this.client = client; // Store client for manual updates
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;

    console.log('[LeaderboardService] Initializing leaderboard service...');
    console.log(`[LeaderboardService] LEADERBOARD_CHANNEL_ID from env: ${channelId || 'NOT SET'}`);

    if (!channelId) {
      console.warn('[LeaderboardService] ⚠️ LEADERBOARD_CHANNEL_ID not set. Leaderboard service will not start.');
      console.warn('[LeaderboardService] Set LEADERBOARD_CHANNEL_ID in your .env file to enable the leaderboard service.');
      return;
    }

    // Validate channel ID is a valid snowflake
    if (!/^\d{17,19}$/.test(channelId)) {
      console.error(`[LeaderboardService] ❌ Invalid LEADERBOARD_CHANNEL_ID format: "${channelId}"`);
      console.error('[LeaderboardService] Must be a valid Discord snowflake (17-19 digit number).');
      return;
    }

    console.log(`[LeaderboardService] ✓ Channel ID validated: ${channelId}`);
    console.log('[LeaderboardService] Starting leaderboard service...');

    // Wait for client to be ready before initial update
    if (client.isReady()) {
      console.log('[LeaderboardService] Client is ready, performing initial update...');
      this.updateLeaderboard(client).catch((error) => {
        console.error('[LeaderboardService] ❌ Error in initial leaderboard update:', error);
        if (error instanceof Error) {
          console.error('[LeaderboardService] Error message:', error.message);
          console.error('[LeaderboardService] Error stack:', error.stack);
        }
      });
    } else {
      console.log('[LeaderboardService] Client not ready yet, will wait for ready event...');
      client.once('ready', () => {
        console.log('[LeaderboardService] Client is now ready, performing initial update...');
        this.updateLeaderboard(client).catch((error) => {
          console.error('[LeaderboardService] ❌ Error in initial leaderboard update:', error);
          if (error instanceof Error) {
            console.error('[LeaderboardService] Error message:', error.message);
            console.error('[LeaderboardService] Error stack:', error.stack);
          }
        });
      });
    }

    // Schedule cron job to run every 3 minutes
    // Cron syntax: */3 * * * * = every 3 minutes
    // Optimal balance: Frequent enough to feel real-time, but safe from Discord API rate limits
    // Editing messages has higher rate limits than creating, so 3 minutes is safe and responsive
    console.log('[LeaderboardService] Scheduling cron job: */3 * * * * (every 3 minutes)');
    this.cronJob = cron.schedule('*/3 * * * *', async () => {
      console.log('[LeaderboardService] ⏰ ========== CRON JOB TRIGGERED ==========');
      console.log('[LeaderboardService] Running Leaderboard Cron...');
      console.log(`[LeaderboardService] Current time: ${new Date().toISOString()}`);
      
      try {
        console.log('[LeaderboardService] Calling updateLeaderboard()...');
        await this.updateLeaderboard(client);
        console.log('[LeaderboardService] ✓ Cron job completed successfully');
      } catch (error) {
        console.error('[LeaderboardService] ❌ Error in scheduled leaderboard update:', error);
        if (error instanceof Error) {
          console.error('[LeaderboardService] Error message:', error.message);
          console.error('[LeaderboardService] Error stack:', error.stack);
        }
      }
      console.log('[LeaderboardService] ========== CRON JOB ENDED ==========');
    });

    console.log('[LeaderboardService] ✓ Leaderboard service started successfully.');
    console.log('[LeaderboardService] Will update every 3 minutes and on bot ready.');
  }

  /**
   * Stop the leaderboard service
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[LeaderboardService] Leaderboard service stopped.');
    }
    this.client = null;
  }

  /**
   * Manually trigger a leaderboard update (called when points change)
   */
  public async triggerUpdate(): Promise<void> {
    if (!this.client) {
      console.warn('[LeaderboardService] Cannot trigger update: Client not available yet.');
      return;
    }

    if (!this.client.isReady()) {
      console.warn('[LeaderboardService] Cannot trigger update: Client not ready yet.');
      return;
    }

    console.log('[LeaderboardService] 🔄 Manual update triggered (points changed)');
    try {
      await this.updateLeaderboard(this.client);
      console.log('[LeaderboardService] ✓ Manual update completed successfully');
    } catch (error) {
      console.error('[LeaderboardService] ❌ Error in manual update:', error);
      if (error instanceof Error) {
        console.error('[LeaderboardService] Error message:', error.message);
        console.error('[LeaderboardService] Error stack:', error.stack);
      }
    }
  }

  /**
   * Force update the leaderboard immediately (for testing/debugging)
   * This is a public method that can be called manually
   */
  public async forceUpdate(): Promise<boolean> {
    console.log('[LeaderboardService] 🔧 FORCE UPDATE REQUESTED');
    
    if (!this.client) {
      console.error('[LeaderboardService] ❌ Cannot force update: Client not available');
      return false;
    }

    if (!this.client.isReady()) {
      console.error('[LeaderboardService] ❌ Cannot force update: Client not ready');
      return false;
    }

    try {
      console.log('[LeaderboardService] Executing force update...');
      await this.updateLeaderboard(this.client);
      console.log('[LeaderboardService] ✓ Force update completed successfully');
      return true;
    } catch (error) {
      console.error('[LeaderboardService] ❌ Error in force update:', error);
      if (error instanceof Error) {
        console.error('[LeaderboardService] Error message:', error.message);
        console.error('[LeaderboardService] Error stack:', error.stack);
      }
      return false;
    }
  }

  /**
   * Update the leaderboard in the configured channel
   */
  private async updateLeaderboard(client: Client): Promise<void> {
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;

    if (!channelId) {
      console.warn('[LeaderboardService] LEADERBOARD_CHANNEL_ID not set, skipping update.');
      return;
    }

    console.log(`[LeaderboardService] Attempting to update leaderboard in channel: ${channelId}`);

    if (!client.isReady()) {
      console.warn('[LeaderboardService] Client is not ready yet, skipping update.');
      return;
    }

    try {
      console.log(`[LeaderboardService] Fetching channel with ID: ${channelId}...`);
      const channel = await client.channels.fetch(channelId);

      if (!channel) {
        console.error(`[LeaderboardService] ❌ Channel with ID ${channelId} not found.`);
        console.error(`[LeaderboardService] Make sure the bot has access to the channel and the ID is correct.`);
        return;
      }

      console.log(`[LeaderboardService] ✓ Channel found: ${channel.id} (${channel.type})`);

      if (!channel.isTextBased()) {
        console.error(`[LeaderboardService] ❌ Channel ${channelId} is not a text-based channel. Type: ${channel.type}`);
        return;
      }

      const textChannel = channel as TextChannel;
      console.log(`[LeaderboardService] Channel name: ${textChannel.name || 'Unknown'}`);

      // Check if bot has permission to send messages
      const botMember = await textChannel.guild.members.fetch(client.user!.id);
      const permissions = textChannel.permissionsFor(botMember);

      if (!permissions) {
        console.error(`[LeaderboardService] ❌ Could not fetch permissions for channel ${channelId}`);
        return;
      }

      const hasSendMessages = permissions.has('SendMessages');
      const hasViewChannel = permissions.has('ViewChannel');
      const hasManageMessages = permissions.has('ManageMessages');

      console.log(`[LeaderboardService] Bot permissions: SendMessages=${hasSendMessages}, ViewChannel=${hasViewChannel}, ManageMessages=${hasManageMessages}`);

      if (!hasSendMessages || !hasViewChannel) {
        console.error(`[LeaderboardService] ❌ Bot lacks required permissions in channel ${channelId}.`);
        console.error(`[LeaderboardService] Required: SendMessages=${hasSendMessages}, ViewChannel=${hasViewChannel}`);
        return;
      }

      // Generate the embed
      console.log('[LeaderboardService] Generating leaderboard embed...');
      const embed = await this.generateEmbed();
      console.log('[LeaderboardService] ✓ Embed generated successfully');

      // Find the last message sent by the bot in this channel
      // Use improved logic: try stored ID first, then search through messages
      let lastMessage: Message | null = null;

      try {
        // First, try to fetch the stored message ID if we have one
        if (this.lastMessageId) {
          console.log(`[LeaderboardService] Attempting to fetch stored message ID: ${this.lastMessageId}`);
          try {
            const storedMessage = await textChannel.messages.fetch(this.lastMessageId);
            if (storedMessage && storedMessage.author.id === client.user?.id) {
              lastMessage = storedMessage;
              console.log(`[LeaderboardService] ✓ Found bot's message using stored ID: ${this.lastMessageId}`);
            } else {
              console.log(`[LeaderboardService] Stored message ID exists but is not from bot, clearing...`);
              this.lastMessageId = null;
            }
          } catch (fetchError: any) {
            // Message not found (deleted or invalid ID)
            if (fetchError.code === 10008 || fetchError.code === 404) {
              console.log(`[LeaderboardService] Stored message ID ${this.lastMessageId} was deleted, clearing...`);
              this.lastMessageId = null;
            } else {
              console.warn(`[LeaderboardService] Error fetching stored message:`, fetchError.message);
              this.lastMessageId = null;
            }
          }
        }

        // If we don't have a valid message yet, search through recent messages
        if (!lastMessage) {
          console.log('[LeaderboardService] Searching through recent messages to find bot\'s last message...');
          console.log('[LeaderboardService] Fetching up to 100 messages...');
          
          let foundBotMessage = false;
          let lastFetchedId: string | undefined;
          const maxIterations = 5; // Search up to 500 messages (5 batches of 100)
          
          for (let i = 0; i < maxIterations && !foundBotMessage; i++) {
            let messages: Collection<string, Message>;
            
            if (lastFetchedId) {
              messages = await textChannel.messages.fetch({ limit: 100, before: lastFetchedId });
            } else {
              messages = await textChannel.messages.fetch({ limit: 100 });
            }
            
            const messageCount = messages.size;
            console.log(`[LeaderboardService] Batch ${i + 1}: Fetched ${messageCount} messages`);
            
            // Find the most recent bot message in this batch
            for (const [id, msg] of messages) {
              if (msg.author.id === client.user?.id) {
                lastMessage = msg;
                foundBotMessage = true;
                console.log(`[LeaderboardService] ✓ Found bot's last message: ${id} (in batch ${i + 1})`);
                this.lastMessageId = id;
                break;
              }
              // Track the last message ID for pagination (oldest message in batch)
              if (!lastFetchedId) {
                lastFetchedId = id;
              } else {
                const currentMsg = messages.get(lastFetchedId);
                if (currentMsg && msg.createdTimestamp < currentMsg.createdTimestamp) {
                  lastFetchedId = id;
                }
              }
            }
            
            // If we got fewer than 100 messages, we've reached the end
            if (messageCount < 100) {
              console.log(`[LeaderboardService] Reached end of message history (batch ${i + 1})`);
              break;
            }
          }
          
          if (!foundBotMessage) {
            console.log('[LeaderboardService] No bot message found in searched history, will send new message');
            this.lastMessageId = null;
          }
        }
      } catch (error) {
        console.error('[LeaderboardService] ❌ Error finding bot message:', error);
        if (error instanceof Error) {
          console.error('[LeaderboardService] Error message:', error.message);
          console.error('[LeaderboardService] Error stack:', error.stack);
        }
        // Clear stored ID on error, will create new message
        this.lastMessageId = null;
        lastMessage = null;
      }

      if (lastMessage) {
        // Edit existing message
        try {
          console.log(`[LeaderboardService] Channel found: ${textChannel.name}`);
          console.log(`[LeaderboardService] Editing existing message: ${lastMessage.id}...`);
          const editedMessage = await lastMessage.edit({ embeds: [embed] });
          this.lastMessageId = editedMessage.id; // Update stored ID
          console.log('[LeaderboardService] Message edited successfully');
          console.log('[LeaderboardService] ✓ Leaderboard updated (edited existing message).');
        } catch (error) {
          console.error('[LeaderboardService] ❌ Error editing message:', error);
          if (error instanceof Error) {
            console.error('[LeaderboardService] Error message:', error.message);
            console.error('[LeaderboardService] Error code:', (error as any).code);
          }
          
          // Check if error is because message was deleted (404 or 10008)
          const errorCode = (error as any).code;
          if (errorCode === 10008 || errorCode === 404) {
            console.log('[LeaderboardService] Message was deleted (error code: ' + errorCode + '), will create a new one...');
            this.lastMessageId = null; // Clear stored ID
            lastMessage = null; // Clear reference so we send a new message
          }
          
          // If editing fails (including deletion), try sending a new message
          if (!lastMessage) {
            try {
              console.log('[LeaderboardService] Attempting to send new message after edit failed...');
              const newMessage = await textChannel.send({ embeds: [embed] });
              this.lastMessageId = newMessage.id; // Store new message ID
              console.log('[LeaderboardService] New message sent successfully');
              console.log('[LeaderboardService] ✓ Leaderboard updated (sent new message after edit failed).');
              console.log(`[LeaderboardService] Stored new message ID: ${this.lastMessageId}`);
            } catch (sendError) {
              console.error('[LeaderboardService] ❌ Error sending new message:', sendError);
              if (sendError instanceof Error) {
                console.error('[LeaderboardService] Error message:', sendError.message);
                console.error('[LeaderboardService] Error code:', (sendError as any).code);
              }
              this.lastMessageId = null; // Clear on failure
              throw sendError; // Re-throw to be caught by outer catch
            }
          }
        }
      } else {
        // No previous message found (deleted or first time) - Send new message
        console.log('[LeaderboardService] No bot message found in channel');
        console.log('[LeaderboardService] Sending new leaderboard message...');
        try {
          const newMessage = await textChannel.send({ embeds: [embed] });
          this.lastMessageId = newMessage.id; // Store new message ID
          console.log('[LeaderboardService] New message sent successfully');
          console.log('[LeaderboardService] ✓ Leaderboard updated (sent new message).');
          console.log(`[LeaderboardService] Stored message ID: ${this.lastMessageId}`);
        } catch (error) {
          console.error('[LeaderboardService] ❌ Error sending message:', error);
          if (error instanceof Error) {
            console.error('[LeaderboardService] Error message:', error.message);
            console.error('[LeaderboardService] Error code:', (error as any).code);
          }
          this.lastMessageId = null;
          throw error; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      console.error('[LeaderboardService] ❌ Critical error updating leaderboard:', error);
      if (error instanceof Error) {
        console.error('[LeaderboardService] Error message:', error.message);
        console.error('[LeaderboardService] Error stack:', error.stack);
      }
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Generate the leaderboard embed with top 10 users
   */
  private async generateEmbed(): Promise<EmbedBuilder> {
    try {
      // Fetch top 10 users sorted by honorPoints descending
      const topUsers = await User.find({})
        .sort({ honorPoints: -1 })
        .limit(10)
        .lean();

      // Build the description with rankings
      let description = '';

      if (topUsers.length === 0) {
        description = '*No warriors have earned honor points yet. Be the first!*';
      } else {
        for (let i = 0; i < topUsers.length; i++) {
          const user = topUsers[i];
          const rank = i + 1;
          const honorPoints = user.honorPoints || 0;

          // Add medal emojis for top 3
          let rankEmoji = '';
          if (rank === 1) {
            rankEmoji = '🥇';
          } else if (rank === 2) {
            rankEmoji = '🥈';
          } else if (rank === 3) {
            rankEmoji = '🥉';
          }

          // Format: 🥇 1. <@userId> - 5000 Honor
          description += `${rankEmoji} ${rank}. <@${user.userId}> - **${honorPoints.toLocaleString()}** Honor\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x8b0000) // Dark red (Wuxia theme)
        .setTitle('📜 Jianghu Rankings (Top 10)')
        .setDescription(description)
        .setFooter({
          text: `Last Updated: ${new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          })}`,
        })
        .setTimestamp();

      return embed;
    } catch (error) {
      console.error('[LeaderboardService] Error generating embed:', error);
      
      // Return error embed if something goes wrong
      return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Loading Leaderboard')
        .setDescription('An error occurred while loading the leaderboard. Please try again later.')
        .setTimestamp();
    }
  }
}
