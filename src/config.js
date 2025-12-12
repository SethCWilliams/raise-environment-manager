require('dotenv').config();

// Slack configuration
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

// Server configuration
const PORT = process.env.PORT || 3000;

// Channel whitelist - comma-separated list of allowed channel IDs
const ALLOWED_CHANNELS = process.env.ALLOWED_CHANNELS
  ? process.env.ALLOWED_CHANNELS.split(',').map(id => id.trim())
  : [];

// Services list - comma-separated list of service names
const SERVICES = process.env.SERVICES
  ? process.env.SERVICES.split(',').map(s => s.trim())
  : [];

// Environment names - comma-separated list of environment names
const ENVIRONMENT_NAMES = process.env.ENVIRONMENTS
  ? process.env.ENVIRONMENTS.split(',').map(e => e.trim().toLowerCase())
  : ['staging', 'dev'];

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

module.exports = {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  PORT,
  ALLOWED_CHANNELS,
  SERVICES,
  ENVIRONMENT_NAMES,
  CACHE_TTL
};
