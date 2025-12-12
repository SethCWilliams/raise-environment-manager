const { normalizeEnvironment, getService, isChannelAllowed, formatDuration } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/forcerelease', async ({ command, ack, say, respond }) => {
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
        text: `Usage: \`/forcerelease <environment> <service>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}`,
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

    // Check if service is claimed
    if (!service.owner) {
      await respond({
        text: `The *${serviceName}* service in *${env}* is not currently claimed.`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Calculate duration
    const duration = formatDuration(service.startTime);
    const previousOwner = service.owner;

    let message = `<@${userId}> force-released *${serviceName}* in *${env}* (was owned by <@${previousOwner}> for ${duration})`;

    // Check if there's a queue and auto-claim for next person
    if (service.queue.length > 0) {
      const nextPerson = service.queue.shift();

      // Automatically claim for the next person
      service.owner = nextPerson.userId;
      service.task = nextPerson.task;
      service.startTime = Date.now();

      message += `\n\n<@${nextPerson.userId}> has automatically claimed *${serviceName}* in *${env}* for: ${nextPerson.task}`;
      saveServiceToDB(env, serviceName, service);
    } else {
      // No queue, release the service
      service.owner = null;
      service.task = null;
      service.startTime = null;
      saveServiceToDB(env, serviceName, service);
    }

    await say({
      text: message,
      response_type: 'in_channel'
    });
  });
};
