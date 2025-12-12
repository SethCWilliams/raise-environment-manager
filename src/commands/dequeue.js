const { normalizeEnvironment, getService, isChannelAllowed } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/dequeue', async ({ command, ack, say, respond }) => {
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
    if (args.length < 2) {
      await respond({
        text: `Usage: \`/dequeue <environment> <service>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}`,
        response_type: 'ephemeral'
      });
      return;
    }

    const env = normalizeEnvironment(args[0].toLowerCase());
    const serviceName = args[1];
    const userId = command.user_id;

    const service = getService(environments, env, serviceName);

    if (!service) {
      await respond({
        text: `Invalid environment or service. Use: staging (s) / dev (d) and one of: ${SERVICES.join(', ')}`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Check if user is in queue
    const queueIndex = service.queue.findIndex(item => item.userId === userId);
    if (queueIndex === -1) {
      await respond({
        text: `You're not in the queue for *${serviceName}* in *${env}*.`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Remove from queue
    service.queue.splice(queueIndex, 1);
    saveServiceToDB(env, serviceName, service);

    await respond({
      text: `You've been removed from the *${serviceName}* queue in *${env}*.`,
      response_type: 'ephemeral'
    });
  });
};
