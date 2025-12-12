const { getUserDisplayName, userCache } = require('../utils/userCache');
const { formatDuration } = require('../utils/helpers');

function setupAPIRoutes(webApp, slackApp, environments) {
  // API endpoint for web dashboard
  webApp.get('/api/environments', async (req, res) => {
    // Collect all unique user IDs that need to be fetched
    const userIds = new Set();

    for (const [envName, env] of Object.entries(environments)) {
      for (const [serviceName, service] of Object.entries(env.services)) {
        if (service.owner) {
          userIds.add(service.owner);
        }
        service.queue.forEach(queueItem => userIds.add(queueItem.userId));
      }
    }

    // Fetch all user display names in parallel
    const userIdArray = Array.from(userIds);
    await Promise.all(userIdArray.map(userId => getUserDisplayName(slackApp, userId)));

    // Now build the response using cached values
    const envData = {};

    for (const [envName, env] of Object.entries(environments)) {
      envData[envName] = {
        services: {}
      };

      for (const [serviceName, service] of Object.entries(env.services)) {
        // Get owner display name from cache (already fetched)
        let ownerName = null;
        if (service.owner) {
          ownerName = userCache[service.owner]?.name || service.owner;
        }

        // Get display names for queue members from cache
        const queueWithNames = service.queue.map(queueItem => ({
          userId: queueItem.userId,
          userName: userCache[queueItem.userId]?.name || queueItem.userId,
          task: queueItem.task
        }));

        envData[envName].services[serviceName] = {
          status: service.owner ? 'in_use' : 'available',
          owner: ownerName,
          task: service.task,
          startTime: service.startTime,
          duration: service.startTime ? formatDuration(service.startTime) : null,
          queue: queueWithNames
        };
      }
    }

    // Disable caching for real-time dashboard
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      environments: envData,
      timestamp: Date.now()
    });
  });
}

module.exports = setupAPIRoutes;
