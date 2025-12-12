const { normalizeEnvironment, isValidEnvironment, getService, isChannelAllowed, isValidService } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/claim', async ({ command, ack, say, respond }) => {
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
        text: `Usage: \`/claim <environment> <service1,service2,...> <task description>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}\nTip: Use commas to claim multiple services at once`,
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
    const queued = [];
    const alreadyInQueue = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (service.owner) {
        // Service is claimed, try to add to queue
        const alreadyQueued = service.queue.find(item => item.userId === userId);
        if (alreadyQueued) {
          alreadyInQueue.push(serviceName);
        } else {
          service.queue.push({ userId, task });
          queued.push({ name: serviceName, position: service.queue.length });
          saveServiceToDB(env, serviceName, service);
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

    // Build response message
    let message = `<@${userId}>:\n`;

    if (claimed.length > 0) {
      message += `✅ *Claimed*: ${claimed.join(', ')}\n`;
    }

    if (queued.length > 0) {
      const queuedText = queued.map(q => `${q.name} (position ${q.position})`).join(', ');
      message += `⏳ *Added to queue*: ${queuedText}\n`;
    }

    if (alreadyInQueue.length > 0) {
      message += `ℹ️ *Already in queue*: ${alreadyInQueue.join(', ')}\n`;
    }

    message += `\n📋 Task: ${task}`;

    await say({
      text: message,
      response_type: 'in_channel'
    });
  });
};
