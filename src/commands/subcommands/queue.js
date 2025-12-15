const { normalizeEnvironment, getService, isValidEnvironment } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { saveServiceToDB } = require('../../database/db');

module.exports = async function({ command, say, respond }, environments, args) {
  const userId = command.user_id;

  if (args.length < 3) {
    await respond({
      text: `Usage: \`/claim queue <environment> <service> <task description>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\n\nType \`/claim help\` for more options!`,
      response_type: 'ephemeral'
    });
    return;
  }

  const env = normalizeEnvironment(args[0].toLowerCase());
  const serviceName = args[1];
  const task = args.slice(2).join(' ');

  if (!isValidEnvironment(env)) {
    await respond({
      text: `Invalid environment "${args[0]}". Type \`/claim help\` for usage.`,
      response_type: 'ephemeral'
    });
    return;
  }

  const service = getService(environments, env, serviceName);

  if (!service) {
    await respond({
      text: `Invalid service "${serviceName}". Available services: ${SERVICES.join(', ')}`,
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
};
