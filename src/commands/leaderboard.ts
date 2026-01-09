import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { User } from '../models/User';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top 10 warriors in the Honor Points leaderboard');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Fetch top 10 users sorted by honorPoints descending
    const topUsers = await User.find({})
      .sort({ honorPoints: -1 })
      .limit(10)
      .lean();

    if (topUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('🏆 Jianghu Rankings (Top 10)')
        .setDescription('*No warriors have earned honor points yet. Be the first!*')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Build description with rankings
    let description = '';

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

      // Format: 🥇 1. Username - 5000 Honor
      description += `${rankEmoji} **${rank}.** <@${user.userId}> - **${honorPoints.toLocaleString()}** Honor\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🏆 Jianghu Rankings (Top 10)')
      .setDescription(description)
      .setFooter({
        text: 'Use /daily to claim rewards and climb the ranks!',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error processing leaderboard command:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while fetching the leaderboard. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
