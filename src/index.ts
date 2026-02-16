import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { connectDB } from './utils/connectDB';
import * as messageCreateEvent from './events/messageCreate';
import * as interactionCreateEvent from './events/interactionCreate';
import { LeaderboardService } from './services/LeaderboardService';
// TODO: Lucky Draw feature postponed - will be implemented in future update alongside PvP Rock-Paper-Scissors
// import { LuckyDrawService } from './services/LuckyDrawService';
import { UserInteractionService } from './services/UserInteractionService';
import { StatusLogService } from './services/StatusLogService';
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
// TODO: Lucky Draw feature postponed - will be implemented in future update alongside PvP Rock-Paper-Scissors
// const luckyDrawService = new LuckyDrawService();
const userInteractionService = new UserInteractionService();
const statusLogService = new StatusLogService();

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

  // TODO: Lucky Draw feature postponed - will be implemented in future update alongside PvP Rock-Paper-Scissors
  // Initialize lucky draw service
  // console.log('[Index] Initializing LuckyDrawService...');
  // luckyDrawService.start(client);
  // console.log('[Index] LuckyDrawService initialization called.');

  // Initialize user interaction service (for persistent buttons)
  console.log('[Index] Initializing UserInteractionService...');
  userInteractionService.start(client);
  console.log('[Index] UserInteractionService initialization called.');

  // Initialize status log service
  console.log('[Index] Initializing StatusLogService...');
  statusLogService.start(client);
  // Register service in registry for event handlers to access
  const { serviceRegistry } = await import('./services/ServiceRegistry');
  serviceRegistry.setStatusLogService(statusLogService);
  serviceRegistry.setLeaderboardService(leaderboardService);
  console.log('[Index] StatusLogService initialization called.');
  console.log('[Index] LeaderboardService registered in ServiceRegistry.');

  // Wait a bit to ensure all guilds and channels are cached
  console.log('[Index] Waiting 2 seconds for Discord cache to populate...');
  await new Promise(resolve => setTimeout(resolve, 2000));
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  // TODO: Lucky Draw feature postponed
  // luckyDrawService.stop();
  userInteractionService.stop();
  statusLogService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  leaderboardService.stop();
  // TODO: Lucky Draw feature postponed
  // luckyDrawService.stop();
  userInteractionService.stop();
  statusLogService.stop();
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
