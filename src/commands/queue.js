const { normalizeEnvironment, getService, isChannelAllowed } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/queue', async ({ command, ack, say, respond }) => {
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
        text: `Usage: \`/queue <environment> <service> <task description>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}`,
        response_type: 'ephemeral'
      });
      return;
    }

    const env = normalizeEnvironment(args[0].toLowerCase());
    const serviceName = args[1];
    const task = args.slice(2).join(' ');
    const userId = command.user_id;

    const service = getService(environments, env, serviceName);

    if (!service) {
      await respond({
        text: `Invalid environment or service. Use: staging (s) / dev (d) and one of: ${SERVICES.join(', ')}`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Check if service is available
    if (!service.owner) {
      await respond({
        text: `The *${serviceName}* service in *${env}* is available! Use \`/claim ${env} ${serviceName} ${task}\` instead.`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Check if user is already in queue
    const alreadyQueued = service.queue.find(item => item.userId === userId);
    if (alreadyQueued) {
      await respond({
        text: `You're already in the queue for *${serviceName}* in *${env}*.`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Add to queue
    service.queue.push({ userId, task });
    const position = service.queue.length;
    saveServiceToDB(env, serviceName, service);

    await say({
      text: `<@${userId}> has been added to the *${serviceName}* queue in *${env}* (position: ${position}) for: ${task}`,
      response_type: 'in_channel'
    });
  });
};
