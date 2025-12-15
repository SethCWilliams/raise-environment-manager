const { normalizeEnvironment, isValidEnvironment, getService, isChannelAllowed, isValidService } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/priority', async ({ command, ack, say, respond }) => {
    await ack();

    // Check if channel is whitelisted
    if (!isChannelAllowed(command.channel_id)) {
      await respond({
        text: 'This bot can only be used in authorized channels.',
        response_type: 'ephemeral'
      });
      return;
    }

    const args = command.text.trim().split(/\s+/);

    if (args.length < 3) {
      await respond({
        text: `Usage: \`/priority <environment> <service1,service2,...> <task description>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}\n\n⚡ This command puts you at the front of the queue (position 1) without kicking anyone out.\nUse this for urgent work like hotfixes.`,
        response_type: 'ephemeral'
      });
      return;
    }

    const env = normalizeEnvironment(args[0].toLowerCase());
    const serviceNames = args[1].split(',').map(s => s.trim());
    const task = args.slice(2).join(' ');
    const userId = command.user_id;

    if (!isValidEnvironment(env)) {
      await respond({
        text: `Invalid environment "${args[0]}". Available environments: staging (or s), dev (or d)`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Validate all services first
    const invalidServices = serviceNames.filter(name => !isValidService(name));
    if (invalidServices.length > 0) {
      await respond({
        text: `Invalid service(s): ${invalidServices.join(', ')}\nAvailable services: ${SERVICES.join(', ')}`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Process each service
    const claimed = [];
    const priorityQueued = [];
    const alreadyOwned = [];
    const movedToFront = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (!service.owner) {
        // Service is available, claim it immediately
        service.owner = userId;
        service.task = task;
        service.startTime = Date.now();
        claimed.push(serviceName);
        saveServiceToDB(env, serviceName, service);
      } else if (service.owner === userId) {
        // User already owns this service
        alreadyOwned.push(serviceName);
      } else {
        // Service is claimed by someone else - add to priority queue
        // Check if user is already in queue
        const existingIndex = service.queue.findIndex(item => item.userId === userId);

        if (existingIndex !== -1) {
          // User already in queue - move them to front
          const [userQueueItem] = service.queue.splice(existingIndex, 1);
          userQueueItem.task = task; // Update task description
          service.queue.unshift(userQueueItem);
          movedToFront.push(serviceName);
        } else {
          // User not in queue - insert at front
          service.queue.unshift({ userId, task });
          priorityQueued.push(serviceName);
        }

        saveServiceToDB(env, serviceName, service);
      }
    }

    // Build response message
    let message = `<@${userId}>:\n`;

    if (claimed.length > 0) {
      message += `✅ *Claimed* (service was available): ${claimed.join(', ')}\n`;
    }

    if (priorityQueued.length > 0) {
      message += `⚡ *Added to PRIORITY queue* (position 1): ${priorityQueued.join(', ')}\n`;
    }

    if (movedToFront.length > 0) {
      message += `⚡ *Moved to PRIORITY queue* (position 1): ${movedToFront.join(', ')}\n`;
    }

    if (alreadyOwned.length > 0) {
      message += `ℹ️ *Already owned by you*: ${alreadyOwned.join(', ')}\n`;
    }

    message += `\n🔥 Task: ${task}`;

    await say({
      text: message,
      response_type: 'in_channel'
    });
  });
};
