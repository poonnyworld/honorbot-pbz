import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { User } from '../models/User';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your honor points profile and ranking');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Feature Flag: Read ENABLE_STREAK from environment
    const enableStreak = process.env.ENABLE_STREAK?.toLowerCase() === 'true';

    // Fetch or create user from DB
    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      // User doesn't exist - create default profile
      user = await User.create({
        userId: interaction.user.id,
        username: interaction.user.username,
        honorPoints: 0,
        lastMessageDate: new Date(),
        dailyPoints: 0,
        lastDailyReset: new Date(0),
        dailyCheckinStreak: 0,
        lastCheckinDate: new Date(0),
      });

      // Build fields array conditionally
      const fields = [
        { name: 'Honor Points', value: '0', inline: true },
        { name: 'Global Rank', value: 'Unranked', inline: true },
      ];

      // Only add Daily Streak field if streak system is enabled
      if (enableStreak) {
        fields.splice(1, 0, { name: 'Daily Streak', value: '0 days', inline: true });
      }

      fields.push({
        name: 'Join Date',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      });

      // Set footer message based on streak system status for new users
      const newUserFooterText = enableStreak
        ? 'Start sending messages or use /daily to begin your journey!'
        : 'Daily streak system is currently disabled. Start sending messages or use /daily to begin your journey!';

      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('🪪 Wanderer Identity')
        .setDescription('Welcome, new wanderer! You have been registered in the Hall of Fame.')
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(fields)
        .setFooter({
          text: newUserFooterText,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Update username if it changed
    if (user.username !== interaction.user.username) {
      user.username = interaction.user.username;
      await user.save();
    }

    // Calculate rank: count users with more honorPoints
    const rank = (await User.countDocuments({
      honorPoints: { $gt: user.honorPoints },
    })) + 1;

    // Get join date (prefer createdAt from mongoose timestamps, fallback to lastMessageDate)
    const joinDate = user.createdAt || user.lastMessageDate || new Date();

    // Get user avatar
    const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });

    // Build fields array conditionally
    const fields = [
      {
        name: 'Honor Points',
        value: `${user.honorPoints.toLocaleString()}`,
        inline: true,
      },
      {
        name: 'Global Rank',
        value: `#${rank}`,
        inline: true,
      },
    ];

    // Only add Daily Streak field if streak system is enabled
    if (enableStreak) {
      fields.splice(1, 0, {
        name: 'Daily Streak',
        value: `${user.dailyCheckinStreak} day${user.dailyCheckinStreak !== 1 ? 's' : ''}`,
        inline: true,
      });
    }

    fields.push({
      name: 'Join Date',
      value: `<t:${Math.floor(joinDate.getTime() / 1000)}:F>`,
      inline: false,
    });

    // Set footer message based on streak system status
    const footerText = enableStreak 
      ? 'Continue your cultivation to climb the ranks!'
      : 'Daily streak system is currently disabled. Continue your cultivation to climb the ranks!';

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🪪 Wanderer Identity')
      .setDescription(`**${interaction.user.username}'s** cultivation record`)
      .setThumbnail(avatarUrl)
      .addFields(fields)
      .setFooter({
        text: footerText,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error processing profile command:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred while fetching your profile. Please try again later.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
