import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View available commands and how to earn honor points');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Get daily message points limit from environment (default: 100)
    const dailyLimit = parseInt(process.env.DAILY_MESSAGE_POINTS_LIMIT || '100', 10);

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('📖 Honor Points Guide')
      .setDescription('Learn the ways of earning honor points in the Jianghu')
      .addFields(
        {
          name: '🔄 /daily',
          value: 'Claim your daily meditation reward. **100 base points** with streak multipliers up to **2x bonus**!\n' +
                 '• Continuous daily check-ins increase your streak\n' +
                 '• Max multiplier: 200 points per day',
          inline: false,
        },
        {
          name: '💬 Chat Activity',
          value: `Earn **1-5 random honor points** by sending messages!\n` +
                 `• 60-second cooldown between rewards\n` +
                 `• Daily limit: **${dailyLimit} points** per day (resets at midnight UTC)\n` +
                 `• Bot messages are ignored`,
          inline: false,
        },
        {
          name: '🪪 /profile',
          value: 'View your personal profile, honor points, streak, and global ranking.',
          inline: false,
        },
        {
          name: '🏆 /leaderboard',
          value: 'Check the top 10 warriors in the Jianghu rankings (private view).',
          inline: false,
        },
        {
          name: '📜 Live Leaderboard',
          value: 'A live leaderboard updates every 3 minutes in the designated channel.',
          inline: false,
        }
      )
      .setFooter({
        text: 'Start your cultivation journey today!',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error processing help command:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
