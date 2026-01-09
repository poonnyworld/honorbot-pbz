import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { connectDB } from './utils/connectDB';
import * as messageCreateEvent from './events/messageCreate';
import * as interactionCreateEvent from './events/interactionCreate';
import { LeaderboardService } from './services/LeaderboardService';
import { startDashboard } from './dashboard/server';

dotenv.config();

console.log('Bot is starting...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const leaderboardService = new LeaderboardService();

// Start dashboard server and pass leaderboardService instance
// This allows the dashboard API to trigger manual leaderboard updates
startDashboard(leaderboardService);

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  console.log('Bot is ready! Use "npm run deploy" to register slash commands.');

  // Initialize leaderboard service
  console.log('[Index] Initializing LeaderboardService...');
  leaderboardService.start(client);
  console.log('[Index] LeaderboardService initialization called.');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  process.exit(0);
});

// Register event handlers
client.on(messageCreateEvent.name, messageCreateEvent.execute);
client.on(interactionCreateEvent.name, interactionCreateEvent.execute);

// Connect to MongoDB
connectDB().catch((error) => {
  console.error('Failed to connect to MongoDB:', error);
  process.exit(1);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});
