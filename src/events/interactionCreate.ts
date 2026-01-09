import { Events, Interaction } from 'discord.js';
import * as dailyCommand from '../commands/daily';
import * as profileCommand from '../commands/profile';
import * as helpCommand from '../commands/help';
import * as leaderboardCommand from '../commands/leaderboard';
import * as backupCommand from '../commands/backup';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;
  console.log(`[InteractionCreate] Received command: ${commandName} from ${interaction.user.tag}`);

  // Handle slash commands
  try {
    switch (commandName) {
      case 'daily':
        await dailyCommand.execute(interaction);
        break;
      case 'profile':
        await profileCommand.execute(interaction);
        break;
      case 'help':
        await helpCommand.execute(interaction);
        break;
      case 'leaderboard':
        await leaderboardCommand.execute(interaction);
        break;
      case 'backup':
        await backupCommand.execute(interaction);
        break;
      default:
        console.warn(`[InteractionCreate] Unknown command: ${commandName}`);
    }
  } catch (error) {
    console.error(`[InteractionCreate] Error executing command ${commandName}:`, error);
    if (error instanceof Error) {
      console.error(`[InteractionCreate] Error message: ${error.message}`);
      console.error(`[InteractionCreate] Error stack: ${error.stack}`);
    }
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error(`[InteractionCreate] Could not send error reply:`, replyError);
    }
  }
}
