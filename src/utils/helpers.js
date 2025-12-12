const { ALLOWED_CHANNELS, SERVICES, ENVIRONMENT_NAMES } = require('../config');

// Helper function to format duration
function formatDuration(startTime) {
  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

// Build environment shortcuts dynamically (first letter of each environment)
// If there are conflicts, the first one wins
function buildEnvironmentShortcuts() {
  const shortcuts = {};
  ENVIRONMENT_NAMES.forEach(envName => {
    const firstLetter = envName.charAt(0).toLowerCase();
    if (!shortcuts[firstLetter]) {
      shortcuts[firstLetter] = envName;
    }
  });
  return shortcuts;
}

const ENV_SHORTCUTS = buildEnvironmentShortcuts();

// Helper function to normalize environment shortcuts
function normalizeEnvironment(env) {
  return ENV_SHORTCUTS[env] || env;
}

// Helper function to check if environment is valid
function isValidEnvironment(env) {
  const normalized = normalizeEnvironment(env);
  return ENVIRONMENT_NAMES.includes(normalized);
}

// Helper function to check if channel is whitelisted
function isChannelAllowed(channelId) {
  // If no whitelist is configured, allow all channels
  if (ALLOWED_CHANNELS.length === 0) {
    return true;
  }
  return ALLOWED_CHANNELS.includes(channelId);
}

// Helper function to check if service is valid
function isValidService(service) {
  return SERVICES.includes(service);
}

// Helper function to get service object
function getService(environments, env, serviceName) {
  if (!isValidEnvironment(env) || !isValidService(serviceName)) {
    return null;
  }
  return environments[env].services[serviceName];
}

module.exports = {
  formatDuration,
  normalizeEnvironment,
  isValidEnvironment,
  isChannelAllowed,
  isValidService,
  getService
};
