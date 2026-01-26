import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { User } from '../models/User';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check your honor points status, daily quota, and cooldown information');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Daily limit for message rewards (5 times per day)
    const DAILY_MESSAGE_REWARD_LIMIT = 5;

    // Find or create user
    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      user = await User.create({
        userId: interaction.user.id,
        username: interaction.user.username,
        honorPoints: 0,
        lastMessageDate: new Date(0),
        dailyPoints: 0,
        lastMessagePointsReset: new Date(),
        dailyMessageCount: 0,
        lastDailyReset: new Date(0),
        dailyCheckinStreak: 0,
        lastCheckinDate: new Date(0),
      });
    } else {
      // Update username in case it changed
      if (user.username !== interaction.user.username) {
        user.username = interaction.user.username;
        await user.save();
      }
    }

    const now = new Date();

    // Calculate cooldown status for message rewards
    const isNewUserFirstMessage = user.lastMessageDate.getTime() === 0;
    let timeSinceLastMessage = 0;
    let cooldownRemaining = 0;
    let isOnCooldown = false;
    
    if (!isNewUserFirstMessage) {
      timeSinceLastMessage = (now.getTime() - user.lastMessageDate.getTime()) / 1000;
      cooldownRemaining = Math.max(0, Math.ceil(60 - timeSinceLastMessage));
      isOnCooldown = timeSinceLastMessage < 60;
    }
    
    const messageCooldownInfo = isOnCooldown
      ? `⏳ Cooldown: **${cooldownRemaining}** วินาที (รอ ${cooldownRemaining} วินาทีเพื่อรับแต้มจากการส่งข้อความ)`
      : '✅ พร้อมรับแต้มจากการส่งข้อความ';

    // Calculate daily command status
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let lastResetDate: Date;
    if (!user.lastDailyReset || user.lastDailyReset.getTime() === 0) {
      lastResetDate = new Date(0);
    } else {
      lastResetDate = new Date(user.lastDailyReset);
    }

    const lastReset = new Date(Date.UTC(
      lastResetDate.getUTCFullYear(),
      lastResetDate.getUTCMonth(),
      lastResetDate.getUTCDate()
    ));

    const dailyCommandStatus = (user.lastDailyReset && user.lastDailyReset.getTime() !== 0 && today.getTime() === lastReset.getTime())
      ? '⏳ **Claimed** (come back tomorrow)'
      : '✅ **Available**';

    // Check if daily message count needs reset
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastResetDateLocal = user.lastMessagePointsReset || new Date(0);
    const lastResetLocal = new Date(
      lastResetDateLocal.getFullYear(),
      lastResetDateLocal.getMonth(),
      lastResetDateLocal.getDate()
    );

    const currentDailyCount = todayLocal.getTime() > lastResetLocal.getTime() 
      ? 0 
      : user.dailyMessageCount;

    const dailyQuotaStatus = currentDailyCount >= DAILY_MESSAGE_REWARD_LIMIT
      ? `Current: **${currentDailyCount}** / Max: **${DAILY_MESSAGE_REWARD_LIMIT}** 🛑 (Limit reached)`
      : `Current: **${currentDailyCount}** / Max: **${DAILY_MESSAGE_REWARD_LIMIT}**`;

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('📋 Today\'s Tasks')
      .setDescription(`Tasks overview for **${interaction.user.username}**`)
      .addFields(
        {
          name: '⚔️ Current Honor Points',
          value: `**${user.honorPoints}** 🏆`,
          inline: false,
        },
        {
          name: '💬 Daily Message Quota',
          value: dailyQuotaStatus,
          inline: false,
        },
        {
          name: '⏱️ Message Cooldown',
          value: messageCooldownInfo,
          inline: false,
        },
        {
          name: '🧘 Daily Check-in',
          value: dailyCommandStatus,
          inline: false,
        }
      )
      .setFooter({
        text: 'Use /help to learn how to earn more honor points',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error processing status command:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while fetching your status. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
