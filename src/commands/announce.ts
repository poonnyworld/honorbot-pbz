import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { AnnouncementService } from '../services/AnnouncementService';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Send bot introduction announcement to instructions channel (Administrator only)');

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

  try {
    console.log(`[Announce] Announcement requested by ${interaction.user.tag} (${interaction.user.id})`);

    if (!interaction.client.isReady()) {
      await interaction.editReply({
        content: '❌ Bot is not ready yet. Please try again in a moment.',
      });
      return;
    }

    // Send announcement
    await AnnouncementService.sendAnnouncement(interaction.client);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Announcement Sent')
      .setDescription('The bot introduction announcement has been sent to the instructions channel.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    console.log(`[Announce] Announcement sent successfully by ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Announce] Error executing announce command:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Error')
      .setDescription(`Failed to send announcement:\n\`\`\`${errorMessage}\`\`\`\n\nCheck the console for more details.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
