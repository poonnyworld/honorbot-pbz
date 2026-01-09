# HonorBot PBZ

A Discord.js v14 bot for managing an honor points system with real-time leaderboards, daily check-ins, and an admin dashboard. Built with TypeScript, MongoDB, and Express.js.

## Features

### 🎮 User Commands

- **`/daily`** - Claim daily honor points with optional streak multiplier
- **`/profile`** - View your honor points, rank, and statistics
- **`/leaderboard`** - Check the top 10 users privately
- **`/help`** - View available commands and how to earn points

### ⚡ Automatic Features

- **Message Points System** - Earn 1-5 random honor points per message (60-second cooldown)
- **Real-time Leaderboard** - Auto-updates every 5 minutes in a designated channel
- **Daily Streak System** - Optional streak multiplier for daily check-ins (configurable via feature flag)

### 👑 Admin Commands

- **`/backup export`** - Export database backup (Administrator only, sent via DM)
- **`/backup import <file>`** - Import database backup from JSON file (Administrator only)

### 🌐 Web Dashboard

- **Admin Panel** - Manage user points and streaks via web interface
- **Real-time Leaderboard** - View and edit top 50 users
- **Search Functionality** - Find users by username
- **Secure Authentication** - Protected with Basic Auth

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local or cloud instance)
- Discord Bot Token
- Discord Application (Client ID)

## Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd honorbot-pbz
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory (you can copy from `.env.example` if it exists):

   ```env
   # Discord Configuration
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_client_id
   GUILD_ID=your_discord_guild_id

   # MongoDB Configuration
   MONGO_URI=mongodb://localhost:27017/honorbot

   # Leaderboard Channel
   LEADERBOARD_CHANNEL_ID=your_leaderboard_channel_id

   # Web Dashboard Configuration
   PORT=3000
   WEB_USER=admin
   WEB_PASS=your_secure_password

   # Feature Flags
   ENABLE_STREAK=false
   ```

4. **Build the project**

   ```bash
   npm run build
   ```

5. **Deploy Discord commands**

   ```bash
   npm run deploy
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Development

For development with auto-reload:

```bash
npm run dev
```

This uses `nodemon` to automatically restart the bot when files change.

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Start MongoDB and the bot**

   ```bash
   docker-compose up -d
   ```

2. **View logs**

   ```bash
   docker-compose logs -f app
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

### Manual Docker Build

```bash
docker build -t honorbot-pbz .
docker run -d --env-file .env -p 3000:3000 honorbot-pbz
```

## Project Structure

```
honorbot-pbz/
├── src/
│   ├── commands/          # Discord slash commands
│   │   ├── backup.ts      # Admin backup/restore commands
│   │   ├── daily.ts       # Daily check-in command
│   │   ├── help.ts        # Help command
│   │   ├── leaderboard.ts # Leaderboard command
│   │   └── profile.ts     # User profile command
│   ├── dashboard/         # Web admin panel
│   │   ├── public/        # Static files (HTML, CSS, JS)
│   │   └── server.ts      # Express server
│   ├── events/            # Discord event handlers
│   │   ├── interactionCreate.ts
│   │   └── messageCreate.ts
│   ├── models/            # Mongoose schemas
│   │   └── User.ts
│   ├── services/          # Business logic services
│   │   ├── BackupService.ts
│   │   └── LeaderboardService.ts
│   ├── utils/             # Utility functions
│   │   └── connectDB.ts
│   ├── deploy-commands.ts # Command deployment script
│   ├── clear-commands.ts  # Command cleanup script
│   └── index.ts           # Main entry point
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile             # Docker build configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Node.js dependencies
├── SECURITY_AUDIT.md      # Security audit report and fixes
└── README.md              # This file
```

## Configuration

### Environment Variables

| Variable                 | Description                                     | Required |
| ------------------------ | ----------------------------------------------- | -------- |
| `DISCORD_TOKEN`          | Discord bot token                               | ✅ Yes   |
| `CLIENT_ID`              | Discord application client ID                   | ✅ Yes   |
| `GUILD_ID`               | Discord server (guild) ID                       | ✅ Yes   |
| `MONGO_URI`              | MongoDB connection string                       | ✅ Yes   |
| `LEADERBOARD_CHANNEL_ID` | Channel ID for leaderboard updates              | ✅ Yes   |
| `PORT`                   | Web dashboard port (default: 3000)              | ❌ No    |
| `WEB_USER`               | Admin panel username (default: admin)           | ❌ No    |
| `WEB_PASS`               | Admin panel password                            | ❌ No    |
| `ENABLE_STREAK`          | Enable daily streak multiplier (default: false) | ❌ No    |

### Feature Flags

- **`ENABLE_STREAK`** - When set to `true`, enables the streak multiplier system for daily check-ins. Users who check in consecutively receive bonus points up to 2x multiplier.

## Usage

### Setting Up Discord Commands

1. **Deploy commands to your server**

   ```bash
   npm run deploy
   ```

2. **Clear all commands (if needed)**
   ```bash
   npm run clear-commands
   ```

### Accessing the Admin Dashboard

1. Start the bot (commands above)
2. Navigate to `http://localhost:3000` in your browser
3. Enter your credentials (default: `admin` / your `WEB_PASS`)
4. Manage users, view leaderboard, edit points

### Backup and Restore

**Export Database:**

```
/backup export
```

The bot will send you a JSON file via Direct Message.

**Import Database:**

```
/backup import
```

Attach a JSON backup file to restore data.

## Scripts

| Script                   | Description                               |
| ------------------------ | ----------------------------------------- |
| `npm run build`          | Compile TypeScript to JavaScript          |
| `npm start`              | Start the production server               |
| `npm run dev`            | Start development server with auto-reload |
| `npm run watch`          | Watch TypeScript files for changes        |
| `npm run deploy`         | Deploy slash commands to Discord          |
| `npm run clear-commands` | Clear all Discord slash commands          |

## Technologies

- **Discord.js v14** - Discord API wrapper
- **TypeScript** - Type-safe JavaScript
- **MongoDB + Mongoose** - Database and ODM
- **Express.js** - Web server framework
- **Node-cron** - Scheduled tasks
- **Tailwind CSS** - Styling for admin panel
- **express-rate-limit** - Rate limiting for API protection
- **express-basic-auth** - HTTP Basic Authentication

## License

ISC

## Security

This project follows security best practices and has undergone a comprehensive security audit. For detailed information about security considerations, vulnerabilities found, and fixes implemented, please see [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

### Security Features

- ✅ **Input Validation** - All user inputs are validated and sanitized
- ✅ **XSS Protection** - Proper HTML escaping and event delegation
- ✅ **Rate Limiting** - API endpoints protected against brute-force and DoS attacks
- ✅ **Authentication** - Basic Auth with strong password requirements
- ✅ **CORS Protection** - Restricted cross-origin requests
- ✅ **NoSQL Injection Protection** - Mongoose parameterized queries
- ✅ **Error Sanitization** - Production-safe error messages
- ✅ **Path Traversal Protection** - Explicit path validation

### Reporting Security Issues

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it privately via:

- Opening a security advisory on GitHub
- Or contact the maintainers directly

We take security seriously and will respond promptly to any security concerns.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.

---

**Note:** Make sure to keep your `.env` file secure and never commit it to version control. The `.gitignore` file is already configured to exclude sensitive files.
