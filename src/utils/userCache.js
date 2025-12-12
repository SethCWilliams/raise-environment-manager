const { CACHE_TTL } = require('../config');

// User info cache to avoid repeated API calls
// Cache entries expire after configured TTL
const userCache = {};

// Clean up expired cache entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, cacheEntry] of Object.entries(userCache)) {
    if (now - cacheEntry.timestamp > CACHE_TTL) {
      delete userCache[userId];
    }
  }
}, 10 * 60 * 1000);

// Helper function to get user display name
async function getUserDisplayName(slackApp, userId) {
  // Check cache first and validate TTL
  const cached = userCache[userId];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.name;
  }

  try {
    const result = await slackApp.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId
    });

    if (result.ok && result.user) {
      // Prefer display_name, fall back to real_name, then to username
      const displayName = result.user.profile.display_name ||
                         result.user.real_name ||
                         result.user.name ||
                         userId;

      // Cache the result with timestamp
      userCache[userId] = {
        name: displayName,
        timestamp: Date.now()
      };
      return displayName;
    }
  } catch (error) {
    console.error(`Error fetching user info for ${userId}:`, error);
  }

  // Return userId as fallback
  return userId;
}

module.exports = {
  userCache,
  getUserDisplayName
};
