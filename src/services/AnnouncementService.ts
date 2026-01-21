import { Client, TextChannel, EmbedBuilder } from 'discord.js';

export class AnnouncementService {
  /**
   * Send bot introduction announcement to INSTRUCTIONS_CHANNEL_ID
   */
  public static async sendAnnouncement(client: Client): Promise<void> {
    const channelId = process.env.INSTRUCTIONS_CHANNEL_ID;

    console.log('[AnnouncementService] Initializing announcement service...');
    console.log(`[AnnouncementService] INSTRUCTIONS_CHANNEL_ID from env: ${channelId || 'NOT SET'}`);

    if (!channelId) {
      console.warn('[AnnouncementService] ⚠️ INSTRUCTIONS_CHANNEL_ID not set. Announcement will not be sent.');
      console.warn('[AnnouncementService] Set INSTRUCTIONS_CHANNEL_ID in your .env file to enable announcements.');
      return;
    }

    // Validate channel ID is a valid snowflake
    if (!/^\d{17,19}$/.test(channelId)) {
      console.error(`[AnnouncementService] ❌ Invalid INSTRUCTIONS_CHANNEL_ID format: "${channelId}"`);
      console.error('[AnnouncementService] Must be a valid Discord snowflake (17-19 digit number).');
      return;
    }

    console.log(`[AnnouncementService] ✓ Channel ID validated: ${channelId}`);

    if (!client.isReady()) {
      console.warn('[AnnouncementService] Client is not ready yet, skipping announcement.');
      return;
    }

    try {
      console.log(`[AnnouncementService] Fetching channel with ID: ${channelId}...`);
      const channel = await client.channels.fetch(channelId);

      if (!channel) {
        console.error(`[AnnouncementService] ❌ Channel with ID ${channelId} not found.`);
        console.error(`[AnnouncementService] Make sure the bot has access to the channel and the ID is correct.`);
        return;
      }

      console.log(`[AnnouncementService] ✓ Channel found: ${channel.id} (${channel.type})`);

      if (!channel.isTextBased()) {
        console.error(`[AnnouncementService] ❌ Channel ${channelId} is not a text-based channel. Type: ${channel.type}`);
        return;
      }

      const textChannel = channel as TextChannel;
      console.log(`[AnnouncementService] Channel name: ${textChannel.name || 'Unknown'}`);

      // Check if bot has permission to send messages
      const botMember = await textChannel.guild.members.fetch(client.user!.id);
      const permissions = textChannel.permissionsFor(botMember);

      if (!permissions) {
        console.error(`[AnnouncementService] ❌ Could not fetch permissions for bot in channel ${channelId}`);
        return;
      }

      if (!permissions.has('SendMessages')) {
        console.error(`[AnnouncementService] ❌ Bot does not have permission to send messages in channel ${channelId}`);
        return;
      }

      if (!permissions.has('EmbedLinks')) {
        console.error(`[AnnouncementService] ❌ Bot does not have permission to embed links in channel ${channelId}`);
        return;
      }

      console.log(`[AnnouncementService] ✓ Permissions validated`);

      // Check if bot has permission to manage messages (for editing)
      const canManageMessages = permissions.has('ManageMessages');
      if (!canManageMessages) {
        console.warn('[AnnouncementService] ⚠️ Bot does not have ManageMessages permission. Will send new message instead of editing.');
      }

      // Get daily message points limit from environment (default: 5)
      const dailyMessageLimit = 5;
      const dailyLimit = parseInt(process.env.DAILY_MESSAGE_POINTS_LIMIT || '100', 10);

      // Create announcement embed
      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('⚔️ Welcome to HonorBot - Your Honor Points System')
        .setDescription(
          'Welcome to the **Jianghu**! This bot tracks your honor points through various activities. ' +
          'Start your cultivation journey and climb the ranks to become the greatest warrior!\n\n' +
          '**How to get started:**\n' +
          '• Use `/help` to view all available commands and earning methods\n' +
          '• Use `/daily` to claim your daily meditation reward\n' +
          '• Chat in the server to earn honor points from messages\n' +
          '• Check your progress with `/profile` and `/status`'
        )
        .addFields(
          {
            name: '🔄 /daily',
            value:
              'Claim your daily meditation reward. Earn **1-10 random honor points** each day!\n' +
              '• Available once per day (resets at midnight UTC)\n' +
              '• Continuous daily check-ins increase your streak',
            inline: false,
          },
          {
            name: '💬 Chat Activity - Message Points',
            value:
              `Earn **1-5 random honor points** per message (max **${dailyMessageLimit} times/day**)\n\n` +
              `**How it works:**\n` +
              `• Send messages in any channel (bot messages are ignored)\n` +
              `• Bot will react with emoji (1️⃣-5️⃣) showing points earned\n` +
              `• ⏳ = Cooldown active (wait 60 seconds)\n` +
              `• ✅ = Daily limit reached (${dailyMessageLimit}th message)\n\n` +
              `**Rules:**\n` +
              `• 60-second cooldown between rewards\n` +
              `• Daily limit: **${dailyMessageLimit} messages** per day (resets at midnight UTC)\n` +
              `• Points distribution: 1 point (80%), 2 points (10%), 3 points (5%), 4 points (3%), 5 points (2%)`,
            inline: false,
          },
          {
            name: '🪪 /profile',
            value:
              'View your personal profile, honor points, daily streak, global ranking, and join date.\n' +
              '• See your current honor points and rank\n' +
              '• Track your daily message progress\n' +
              '• Check your daily check-in status',
            inline: false,
          },
          {
            name: '📊 /status',
            value:
              'Check your current status including honor points, daily message quota, cooldown status, and daily command availability.\n' +
              '• View your current honor points\n' +
              '• See how many messages you\'ve sent today\n' +
              '• Check cooldown timer for message rewards',
            inline: false,
          },
          {
            name: '🏆 /leaderboard',
            value:
              'View the top 10 warriors in the Jianghu rankings.\n' +
              '• See who leads the honor points race\n' +
              '• Check your position among the elite\n' +
              '• Rankings update in real-time',
            inline: false,
          },
          {
            name: '📜 Live Leaderboard',
            value:
              'A live leaderboard automatically updates every 3 minutes in the designated leaderboard channel.\n' +
              '• See real-time rankings\n' +
              '• Track your progress visually\n' +
              '• Compete with other warriors',
            inline: false,
          },
          {
            name: '📖 /help',
            value:
              'Get detailed information about all commands and how to earn honor points.\n' +
              '• Comprehensive guide to all features\n' +
              '• Learn earning methods\n' +
              '• Understand the honor points system',
            inline: false,
          }
        )
        .setFooter({
          text: 'Start your cultivation journey today! Use /help for more information.',
        })
        .setTimestamp();

      // Try to find existing announcement message
      console.log(`[AnnouncementService] Searching for existing announcement message...`);
      let existingMessage = null;
      
      try {
        // Fetch recent messages from the bot in this channel
        const messages = await textChannel.messages.fetch({ limit: 50 });
        
        // Find the most recent message from the bot with the announcement title
        for (const message of messages.values()) {
          if (
            message.author.id === client.user!.id &&
            message.embeds.length > 0 &&
            message.embeds[0].title === '⚔️ Welcome to HonorBot - Your Honor Points System'
          ) {
            existingMessage = message;
            console.log(`[AnnouncementService] ✓ Found existing announcement message: ${message.id}`);
            break;
          }
        }
      } catch (error) {
        console.warn('[AnnouncementService] ⚠️ Could not fetch messages to find existing announcement:', error);
        // Continue to send new message
      }

      // Edit existing message or send new one
      if (existingMessage) {
        try {
          console.log(`[AnnouncementService] Editing existing announcement message...`);
          const editedMessage = await existingMessage.edit({ embeds: [embed] });
          console.log(`[AnnouncementService] ✓ Announcement updated successfully (edited existing message)!`);
          console.log(`[AnnouncementService] Message ID: ${editedMessage.id}`);
          console.log(`[AnnouncementService] Channel: ${textChannel.name} (${channelId})`);
          console.log(`[AnnouncementService] Guild: ${textChannel.guild.name} (${textChannel.guild.id})`);
        } catch (error) {
          console.warn('[AnnouncementService] ⚠️ Could not edit existing message, sending new one instead:', error);
          // Fallback to sending new message
          const message = await textChannel.send({ embeds: [embed] });
          console.log(`[AnnouncementService] ✓ Announcement sent successfully (new message)!`);
          console.log(`[AnnouncementService] Message ID: ${message.id}`);
          console.log(`[AnnouncementService] Channel: ${textChannel.name} (${channelId})`);
          console.log(`[AnnouncementService] Guild: ${textChannel.guild.name} (${textChannel.guild.id})`);
        }
      } else {
        // Send new announcement
        console.log(`[AnnouncementService] No existing announcement found, sending new message...`);
        const message = await textChannel.send({ embeds: [embed] });
        console.log(`[AnnouncementService] ✓ Announcement sent successfully (new message)!`);
        console.log(`[AnnouncementService] Message ID: ${message.id}`);
        console.log(`[AnnouncementService] Channel: ${textChannel.name} (${channelId})`);
        console.log(`[AnnouncementService] Guild: ${textChannel.guild.name} (${textChannel.guild.id})`);
      }
    } catch (error) {
      console.error('[AnnouncementService] ❌ Error sending announcement:', error);
      if (error instanceof Error) {
        console.error('[AnnouncementService] Error message:', error.message);
        console.error('[AnnouncementService] Error stack:', error.stack);
        
        // Provide more specific error information
        if (error.message.includes('Missing Access')) {
          console.error('[AnnouncementService] ❌ Bot does not have access to the channel. Check channel permissions.');
        } else if (error.message.includes('Missing Permissions')) {
          console.error('[AnnouncementService] ❌ Bot is missing required permissions. Check: SendMessages, EmbedLinks');
        } else if (error.message.includes('Unknown Channel')) {
          console.error('[AnnouncementService] ❌ Channel not found. Verify INSTRUCTIONS_CHANNEL_ID is correct.');
        }
      }
      throw error; // Re-throw to allow caller to handle
    }
  }
}
