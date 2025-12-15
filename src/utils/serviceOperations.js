const { getService, formatDuration } = require('./helpers');
const { saveServiceToDB } = require('../database/db');

/**
 * Process claim for multiple services
 * @returns {Object} { claimed, queued, alreadyInQueue, alreadyOwned }
 */
function processClaim(environments, env, serviceNames, userId, task) {
  const claimed = [];
  const queued = [];
  const alreadyInQueue = [];
  const alreadyOwned = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    if (service.owner) {
      // Check if user already owns this service
      if (service.owner === userId) {
        alreadyOwned.push(serviceName);
      } else {
        // Service is claimed by someone else, try to add to queue
        const alreadyQueued = service.queue.find(item => item.userId === userId);
        if (alreadyQueued) {
          alreadyInQueue.push(serviceName);
        } else {
          service.queue.push({ userId, task });
          queued.push({ name: serviceName, position: service.queue.length });
          saveServiceToDB(env, serviceName, service);
        }
      }
    } else {
      // Service is available, claim it
      service.owner = userId;
      service.task = task;
      service.startTime = Date.now();
      claimed.push(serviceName);
      saveServiceToDB(env, serviceName, service);
    }
  }

  return { claimed, queued, alreadyInQueue, alreadyOwned };
}

/**
 * Process release for multiple services
 * @returns {Object} { released, notOwned, autoClaimed }
 */
function processRelease(environments, env, serviceNames, userId) {
  const released = [];
  const notOwned = [];
  const autoClaimed = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    if (!service) {
      continue;
    }

    // Check if user owns this service
    if (service.owner !== userId) {
      if (!service.owner) {
        notOwned.push({ name: serviceName, reason: 'not claimed' });
      } else {
        notOwned.push({ name: serviceName, reason: 'owned by someone else' });
      }
      continue;
    }

    // Calculate duration
    const duration = formatDuration(service.startTime);
    released.push({ name: serviceName, duration });

    // Check if there's a queue and auto-claim for next person
    if (service.queue.length > 0) {
      const nextPerson = service.queue.shift();

      // Automatically claim for the next person
      service.owner = nextPerson.userId;
      service.task = nextPerson.task;
      service.startTime = Date.now();

      autoClaimed.push({
        name: serviceName,
        nextUser: nextPerson.userId,
        task: nextPerson.task
      });
      saveServiceToDB(env, serviceName, service);
    } else {
      // No queue, release the service
      service.owner = null;
      service.task = null;
      service.startTime = null;
      saveServiceToDB(env, serviceName, service);
    }
  }

  return { released, notOwned, autoClaimed };
}

/**
 * Process force-release for multiple services
 * @returns {Object} { released, notClaimed, autoClaimed }
 */
function processForceRelease(environments, env, serviceNames, adminUserId) {
  const released = [];
  const notClaimed = [];
  const autoClaimed = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    if (!service) {
      continue;
    }

    // Check if service is claimed
    if (!service.owner) {
      notClaimed.push(serviceName);
      continue;
    }

    // Calculate duration
    const duration = formatDuration(service.startTime);
    const previousOwner = service.owner;

    released.push({
      name: serviceName,
      duration,
      previousOwner
    });

    // Check if there's a queue and auto-claim for next person
    if (service.queue.length > 0) {
      const nextPerson = service.queue.shift();

      // Automatically claim for the next person
      service.owner = nextPerson.userId;
      service.task = nextPerson.task;
      service.startTime = Date.now();

      autoClaimed.push({
        name: serviceName,
        nextUser: nextPerson.userId,
        task: nextPerson.task
      });
      saveServiceToDB(env, serviceName, service);
    } else {
      // No queue, release the service
      service.owner = null;
      service.task = null;
      service.startTime = null;
      saveServiceToDB(env, serviceName, service);
    }
  }

  return { released, notClaimed, autoClaimed };
}

module.exports = {
  processClaim,
  processRelease,
  processForceRelease
};
