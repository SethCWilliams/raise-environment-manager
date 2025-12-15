const { App } = require('@slack/bolt');
const express = require('express');
const path = require('path');

// Configuration
const config = require('./src/config');

// Database
const { initializeEnvironments } = require('./src/database/db');

// Routes
const setupAPIRoutes = require('./src/routes/api');

// Commands
const setupClaimCommand = require('./src/commands/claim');

// Initialize the Slack app
const app = new App({
  token: config.SLACK_BOT_TOKEN,
  signingSecret: config.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: config.SLACK_APP_TOKEN,
});

// Initialize Express for web dashboard
const webApp = express();

// Serve static files from public directory
webApp.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for environment state (loaded from database)
const environments = initializeEnvironments();

// Setup Slack commands
setupClaimCommand(app, environments);

// Setup API routes
setupAPIRoutes(webApp, app, environments);

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Environment Manager Bot is running!');

  // Start Express web server
  webApp.listen(config.PORT, () => {
    console.log(`📊 Dashboard available at http://localhost:${config.PORT}`);
  });
})();
