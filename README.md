# Environment Manager Bot

A Slack bot for managing environment deployments. Allows teams to claim, release, and queue for shared environments like staging and dev.

## Features

**Slack Commands:**
- **Multi-service claiming**: Claim multiple services at once with comma-separated names
- **Environment shortcuts**: Use `s` for staging, `d` for dev
- **Automatic queueing**: Trying to claim a busy service automatically adds you to queue
- **Smart auto-claiming**: Next person in queue automatically gets the service when released
- Force release any service (override ownership)
- Track service usage duration
- View status of all services across environments
- Remove yourself from queue

**Web Dashboard:**
- Real-time environment status display
- Clean, modern interface with dark theme
- Auto-refresh with smart tab visibility detection
- Shows current owner, task, duration, and queue
- No manual refresh needed - updates automatically

## Prerequisites

- Node.js 16.x or higher
- A Slack workspace where you have admin permissions
- Slack app credentials (see setup below)

## Setup

### 1. Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "Environment Manager" and select your workspace
4. Click "Create App"

### 2. Enable Socket Mode

1. Go to "Socket Mode" in the left sidebar
2. Enable Socket Mode
3. Generate an App-Level Token:
   - Token Name: `env-manager`
   - Scope: `connections:write`
4. Save the token (starts with `xapp-`)

### 3. Configure Bot Token Scopes

1. Go to "OAuth & Permissions"
2. Under "Bot Token Scopes", add these scopes:
   - `chat:write`
   - `commands`
   - `users:read` (required for dashboard to show real names)
3. Install the app to your workspace
4. Save the "Bot User OAuth Token" (starts with `xoxb-`)

### 4. Create Slash Commands

Go to "Slash Commands" and create these six commands:

**Command 1: /claim**
- Command: `/claim`
- Request URL: Leave blank (Socket Mode handles this)
- Short Description: `Claim an environment`
- Usage Hint: `<environment> <task description>`

**Command 2: /release**
- Command: `/release`
- Request URL: Leave blank
- Short Description: `Release your environment`
- Usage Hint: `<environment>`

**Command 3: /queue**
- Command: `/queue`
- Request URL: Leave blank
- Short Description: `Queue for an environment`
- Usage Hint: `<environment> <task description>`

**Command 4: /envstatus**
- Command: `/envstatus`
- Request URL: Leave blank
- Short Description: `View environment status`
- Usage Hint: (leave blank)

**Command 5: /forcerelease**
- Command: `/forcerelease`
- Request URL: Leave blank
- Short Description: `Force release any environment`
- Usage Hint: `<environment>`

**Command 6: /dequeue**
- Command: `/dequeue`
- Request URL: Leave blank
- Short Description: `Remove yourself from queue`
- Usage Hint: `<environment>`

### 5. Get Signing Secret

1. Go to "Basic Information"
2. Find "Signing Secret" under "App Credentials"
3. Click "Show" and copy it

### 6. Install Dependencies

```bash
cd env-manager-bot
npm install
```

### 7. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   ENVIRONMENTS=staging,dev
   SERVICES=your-service-names-here
   ALLOWED_CHANNELS=
   ```

3. **(Optional) Configure Custom Environments**:

   By default, the bot supports `staging` and `dev` environments. You can customize this:

   ```
   ENVIRONMENTS=staging,dev,qa,production,demo
   ```

   **Features:**
   - Environment shortcuts work automatically (first letter: `s` → staging, `d` → dev, `q` → qa, `p` → production)
   - If multiple environments start with the same letter, the first one gets the shortcut
   - Leave empty to use the default (`staging,dev`)

4. **(Optional) Configure Channel Whitelist**:

   To restrict the bot to specific channels only, add channel IDs to `ALLOWED_CHANNELS`:

   ```
   ALLOWED_CHANNELS=C01234567,C09876543
   ```

   **How to get a channel ID:**
   - In Slack, right-click on the channel name
   - Select "View channel details"
   - Scroll down - the channel ID is at the bottom
   - Or: Click the channel name → "About" tab → Channel ID at bottom

   **Leave empty to allow all channels** (default behavior)

### 8. Start the Bot

```bash
npm install
npm start
```

You should see:
```
📁 Loaded environment state from database
⚡️ Environment Manager Bot is running!
📊 Dashboard available at http://localhost:3000
```

**Note:** On first run, a SQLite database file (`environments.db`) will be created automatically in the project root. All environment claims and queues are persisted to this database, so your state survives server restarts.

## Web Dashboard

Access the live dashboard at **http://localhost:3000**

The dashboard shows:
- Real-time environment status (Available/In Use)
- Current owner and task description
- Duration of usage
- Queue with positions and tasks
- Auto-refreshes every 5 seconds (only when tab is active)

**Smart Features:**
- Automatically pauses updates when you switch tabs (saves resources)
- Resumes polling when you return to the tab
- Shows connection status
- Modern, clean interface with dark theme

**Customize Port:**
Add to your `.env` file:
```
PORT=8080
```

## Usage

### Claim Services

Claim one or more services in an environment:

```
/claim s fundraisers-api deploying feature-123
/claim staging fundraisers-api,fundraisers-worker testing hotfix
```

**Features:**
- Use `s` for staging or `d` for dev (shortcuts!)
- Claim multiple services at once with comma-separated names
- If a service is available, it's claimed immediately
- If a service is already claimed, you're automatically added to the queue
- Shows a summary of what was claimed, queued, or already in queue

### Release Services

Release one or more services you own:

```
/release s fundraisers-api
/release staging fundraisers-api,fundraisers-worker
/release s
```

**Features:**
- **Release all**: Just specify environment to release ALL services you own (e.g., `/release s`)
- Release multiple specific services with comma-separated names
- Shows usage duration for each service
- Automatically gives services to next person in queue
- Won't let you release services you don't own

### Queue for Services (Optional)

```
/queue d fundraisers-api testing hotfix
```

**Note:** You usually don't need this! The `/claim` command automatically adds you to the queue if a service is already claimed.

Manual queueing is useful when you know in advance a service is busy.

### Check Environment Status

```
/envstatus
```

Shows only services that are currently in use:
- Current owner and task for each in-use service
- Duration in use
- Queue positions for each service
- If nothing is in use, shows "All services are currently available!"

### Force Release Services

```
/forcerelease s fundraisers-api
```

Forcibly releases any service, regardless of who owns it. Use this when:
- Someone forgot to release a service
- A service is stuck/blocked
- You need to override the current owner

Shows who released it, who previously owned it, and the duration. Automatically gives to next person in queue.

### Remove Yourself from Queue

```
/dequeue d fundraisers-api
```

Removes yourself from the queue for a service. Use this when:
- You no longer need the service
- Your task is cancelled or completed another way

## Available Environments

By default:
- `staging` (shortcut: `s`)
- `dev` (shortcut: `d`)

**To customize environments:**
Add the `ENVIRONMENTS` variable to your `.env` file:

```
ENVIRONMENTS=staging,dev,qa,production,demo
```

Environment shortcuts are automatically generated from the first letter of each environment name. For example:
- `s` → staging
- `d` → dev
- `q` → qa
- `p` → production

If multiple environments start with the same letter, only the first one gets the shortcut.

## Channel Whitelist

By default, the bot works in any channel. To restrict it to specific channels:

1. Get the channel IDs (right-click channel → View channel details → scroll to bottom)
2. Add them to your `.env` file:
   ```
   ALLOWED_CHANNELS=C01234567,C09876543,C11111111
   ```
3. Restart the bot

**When restricted:**
- Commands only work in whitelisted channels
- Users in other channels see: "This bot can only be used in authorized channels" (ephemeral)
- Great for keeping environment management in a dedicated channel like `#deployments`

## Troubleshooting

**Bot not responding?**
- Make sure the bot is running (`npm start`)
- Check that Socket Mode is enabled
- Verify all three tokens are correct in `.env`

**Commands not appearing?**
- Reinstall the app to your workspace
- Check that all slash commands are created in your Slack app settings

**Permission errors?**
- Ensure bot has `chat:write` and `commands` scopes
- Reinstall the app after adding scopes

**"This bot can only be used in authorized channels"?**
- Check your `ALLOWED_CHANNELS` setting in `.env`
- Make sure the channel ID is correct
- Leave `ALLOWED_CHANNELS` empty to allow all channels

**Dashboard not loading?**
- Make sure you ran `npm install` after adding the dashboard
- Check that the bot is running
- Verify you're accessing `http://localhost:3000` (or your custom PORT)
- Check browser console for errors

**Dashboard not updating?**
- Check that your browser tab is active (polling pauses when tab is hidden)
- Look for "Connected" status in the header
- Check browser console for network errors

**Dashboard showing user IDs instead of names?**
- Make sure you added the `users:read` scope to your bot
- Go to "OAuth & Permissions" → "Bot Token Scopes" → Add `users:read`
- Reinstall the app to your workspace after adding the scope
- Restart the bot

## Architecture

- **Framework**: @slack/bolt with Socket Mode
- **Web Server**: Express.js serving REST API and static dashboard
- **Storage**: SQLite database (`environments.db`) with automatic persistence
- **Code Structure**: Modular architecture with separate config, database, routes, and command handlers
- **Environments**: Tracked with owner, task, startTime, and queue (persisted across restarts)
- **Channel Whitelist**: Optional restriction to specific channels via environment variable
- **Dashboard**: Auto-refreshing with smart tab visibility detection (polling only when active)
- **Performance**: Parallel API calls, user caching with TTL, incremental DOM updates

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation of the code structure.**

## Performance Features

✅ **Completed Optimizations:**
1. **Parallel API calls** - User display names fetched concurrently (~70% faster dashboard loads)
2. **User cache with TTL** - 1-hour cache prevents memory leaks and reduces API calls
3. **Incremental DOM updates** - Dashboard only updates changed services (reduces flickering)
4. **SQLite persistence** - All state automatically saved and restored on restart

**See [OPTIMIZATIONS.md](./OPTIMIZATIONS.md) for the full list of potential improvements.**

## Deploying to Railway

This app is configured for easy deployment to Railway with persistent SQLite storage.

### Prerequisites

1. [Railway account](https://railway.app/) (sign up for free)
2. Your Slack app credentials (tokens from setup above)
3. Git repository (preferably on GitHub)

### Deployment Steps

#### 1. Create a New Project on Railway

- Go to [Railway](https://railway.app/) and create a new project
- Choose "Deploy from GitHub repo" or use the Railway CLI

#### 2. Add a Volume for Database Persistence

In your Railway project:
1. Go to your service settings
2. Click on "Volumes" in the left sidebar
3. Click "New Volume"
4. Set the mount path to: `/data`
5. Volume will be created (minimum 5GB on Hobby plan, but you only pay for what you use)

#### 3. Configure Environment Variables

In Railway's dashboard, add these variables:

**Required:**
- `SLACK_BOT_TOKEN` - Your bot token (xoxb-...)
- `SLACK_SIGNING_SECRET` - Your signing secret
- `SLACK_APP_TOKEN` - Your app token (xapp-...)
- `SERVICES` - Comma-separated service names
- `DB_PATH` - Set to `/data/environments.db` (for volume persistence)

**Optional:**
- `ENVIRONMENTS` - Comma-separated environment names (defaults to `staging,dev`)
- `ALLOWED_CHANNELS` - Comma-separated channel IDs (leave empty to allow all)
- `PORT` - Railway sets this automatically, no need to configure

#### 4. Deploy

- Railway will automatically deploy when you push to your connected branch
- Or use the Railway CLI: `railway up`

#### 5. Verify Deployment

- Check the deployment logs for "Environment Manager Bot is running!"
- Railway will provide a public URL for your dashboard
- Test Slack commands in your workspace

### Cost Estimate

With SQLite and a volume:
- **Hobby plan**: $5/month subscription (includes $5 usage credit)
- **Volume storage**: ~$0.01-0.15/month (you only pay for actual data stored)
- **Total**: Likely free or minimal cost for this lightweight app

### Important Notes

- The volume is persistent - your database survives deployments and restarts
- You only pay $0.15/GB/month for actual storage used (your DB is likely < 1MB)
- Railway auto-deploys when you push to your repository
- The app uses Socket Mode, so no webhook URL configuration needed

### Troubleshooting Railway Deployment

**Volume not persisting:**
- Verify `DB_PATH=/data/environments.db` is set in environment variables
- Check that volume is mounted at `/data`
- View logs to ensure database is being created at the correct path

**App crashing on startup:**
- Check Railway logs for error messages
- Verify all required environment variables are set
- Ensure Slack tokens are correct

**High costs:**
- You should only be paying for actual storage used (~pennies/month)
- Check your Railway dashboard for resource usage
- Volume is billed at $0.15/GB/month, but only for space actually used

## Future Enhancements

- Auto-release after timeout
- Slack notifications (DMs when auto-claimed, reminders)
- Environment-specific notifications
- Usage statistics and reports (audit logs, analytics dashboard)
- Multiple environment types beyond staging/dev
- Role-based permissions for force-release
- Reservation system (book environments in advance)

## License

ISC
