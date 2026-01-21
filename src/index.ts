import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { connectDB } from './utils/connectDB';
import * as messageCreateEvent from './events/messageCreate';
import * as interactionCreateEvent from './events/interactionCreate';
import { LeaderboardService } from './services/LeaderboardService';
import { LuckyDrawService } from './services/LuckyDrawService';
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
const luckyDrawService = new LuckyDrawService();

// Start dashboard server and pass leaderboardService instance
// This allows the dashboard API to trigger manual leaderboard updates
startDashboard(leaderboardService);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  console.log('Bot is ready! Use "npm run deploy" to register slash commands.');

  // Initialize leaderboard service
  console.log('[Index] Initializing LeaderboardService...');
  leaderboardService.start(client);
  console.log('[Index] LeaderboardService initialization called.');

  // Initialize lucky draw service
  console.log('[Index] Initializing LuckyDrawService...');
  luckyDrawService.start(client);
  console.log('[Index] LuckyDrawService initialization called.');

  // Wait a bit to ensure all guilds and channels are cached
  console.log('[Index] Waiting 2 seconds for Discord cache to populate...');
  await new Promise(resolve => setTimeout(resolve, 2000));
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  luckyDrawService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  luckyDrawService.stop();
  process.exit(0);
});

// Register event handlers
client.on(messageCreateEvent.name, messageCreateEvent.execute);
client.on(interactionCreateEvent.name, interactionCreateEvent.execute);

// Connect to MongoDB (non-blocking - bot will continue even if MongoDB fails)
connectDB().catch((error) => {
  console.error('Failed to connect to MongoDB:', error);
  // Don't exit - allow bot to run without database for testing
  // process.exit(1);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});
