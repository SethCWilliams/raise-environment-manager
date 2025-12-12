# Environment Manager Architecture

## Project Structure

```
env-manager-bot/
├── app.js                 # Main entry point (60 lines)
├── src/
│   ├── config.js          # Configuration and environment variables
│   ├── database/
│   │   └── db.js          # SQLite database operations
│   ├── utils/
│   │   ├── helpers.js     # Utility functions (formatDuration, validation, etc.)
│   │   └── userCache.js   # User display name caching with TTL
│   ├── routes/
│   │   └── api.js         # Express API endpoints
│   └── commands/
│       ├── claim.js       # /claim command handler
│       ├── release.js     # /release command handler
│       ├── queue.js       # /queue command handler
│       ├── dequeue.js     # /dequeue command handler
│       ├── envstatus.js   # /envstatus command handler
│       └── forcerelease.js # /forcerelease command handler
├── public/
│   ├── index.html         # Dashboard HTML
│   ├── app.js             # Dashboard JavaScript
│   └── styles.css         # Dashboard styles
├── environments.db        # SQLite database (auto-created)
├── .env                   # Environment variables
└── package.json           # Dependencies

```

## Module Descriptions

### `app.js` (Main Entry Point)
- Initializes Slack app and Express server
- Loads environment state from database
- Registers all command handlers
- Sets up API routes
- ~60 lines (down from 700+)

### `src/config.js`
- Centralizes all configuration
- Exports: SLACK tokens, PORT, ALLOWED_CHANNELS, SERVICES, CACHE_TTL

### `src/database/db.js`
- SQLite database initialization
- Schema creation (services, queue tables)
- CRUD operations (save/load services and queues)
- `initializeEnvironments()` - loads state from DB on startup

### `src/utils/helpers.js`
- `formatDuration(startTime)` - converts milliseconds to human-readable format
- `normalizeEnvironment(env)` - converts shortcuts (s → staging, d → dev)
- `isValidEnvironment(env)` - validates environment names
- `isChannelAllowed(channelId)` - checks whitelist
- `isValidService(service)` - validates service names
- `getService(environments, env, serviceName)` - retrieves service object

### `src/utils/userCache.js`
- User display name caching with 1-hour TTL
- Automatic cache cleanup every 10 minutes
- `getUserDisplayName(slackApp, userId)` - fetches or returns cached name

### `src/routes/api.js`
- `GET /api/environments` - returns environment state as JSON
- Parallel user display name fetching
- No-cache headers for real-time updates

### `src/commands/*.js`
Each command module exports a setup function that:
- Registers the command handler with the Slack app
- Validates inputs and permissions
- Updates environment state
- Persists changes to database
- Sends responses to Slack

## Data Flow

### Claim Flow
1. User runs `/claim staging api-service my-task`
2. `claim.js` validates environment and service
3. Updates in-memory `environments` object
4. Calls `saveServiceToDB()` to persist
5. Sends confirmation to Slack channel

### Dashboard Flow
1. Frontend polls `/api/environments` every 5 seconds
2. `api.js` collects all user IDs
3. Fetches display names in parallel (cached)
4. Builds response with current state
5. Frontend incrementally updates changed cards

### Startup Flow
1. `db.js` creates/opens `environments.db`
2. `initializeEnvironments()` loads all services and queues from DB
3. App registers commands and starts Express server
4. Previous state is restored automatically

## Performance Optimizations

1. **Parallel API calls** - User display names fetched concurrently
2. **User cache with TTL** - 1-hour cache prevents memory leaks
3. **Incremental DOM updates** - Dashboard only updates changed services
4. **Database persistence** - State survives restarts

## Benefits of New Structure

- **Modularity**: Each command in its own file
- **Maintainability**: Easy to find and update code
- **Testability**: Modules can be unit tested independently
- **Readability**: Clear separation of concerns
- **Scalability**: Easy to add new commands or features
