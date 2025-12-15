const { normalizeEnvironment, getService, isValidEnvironment, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { saveServiceToDB } = require('../../database/db');
const dequeueModal = require('../modals/dequeueModal');

module.exports = async function({ command, respond, client }, environments, args) {
  const userId = command.user_id;

  // Case 1: No args - show modal with all queues
  if (args.length === 0) {
    try {
      await dequeueModal.showModal({ client, command, userId, environments });
    } catch (error) {
      if (error.message === 'NOT_IN_ANY_QUEUE') {
        await respond({
          text: `You're not in any queues.`,
          response_type: 'ephemeral'
        });
      } else {
        await respond({
          text: 'Failed to open interactive dialog. Please try again.',
          response_type: 'ephemeral'
        });
      }
    }
    return;
  }

  if (args.length < 2) {
    await respond({
      text: `Usage: \`/claim dequeue <environment> <service1,service2,...>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\nTip: Use commas to dequeue from multiple services at once\n\nOr use \`/claim dequeue\` for an interactive menu!\n\nType \`/claim help\` for more options!`,
      response_type: 'ephemeral'
    });
    return;
  }

  const env = normalizeEnvironment(args[0].toLowerCase());
  const serviceNames = args[1].split(',').map(s => s.trim());

  if (!isValidEnvironment(env)) {
    await respond({
      text: `Invalid environment "${args[0]}". Type \`/claim help\` for usage.`,
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
  const removed = [];
  const notInQueue = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    // Check if user is in queue
    const queueIndex = service.queue.findIndex(item => item.userId === userId);
    if (queueIndex === -1) {
      notInQueue.push(serviceName);
    } else {
      service.queue.splice(queueIndex, 1);
      removed.push(serviceName);
      saveServiceToDB(env, serviceName, service);
    }
  }

  // Build response message
  let message = '';

  if (removed.length > 0) {
    message += `✅ Removed from queue in *${env}*: ${removed.join(', ')}\n`;
  }

  if (notInQueue.length > 0) {
    message += `⚠️ Not in queue: ${notInQueue.join(', ')}`;
  }

  await respond({
    text: message.trim(),
    response_type: 'ephemeral'
  });
};
