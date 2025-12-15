const { normalizeEnvironment, isValidEnvironment, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const queueModal = require('../modals/queueModal');

module.exports = async function({ command, say, respond, client }, environments, args) {
  const userId = command.user_id;

  // Case 1: No args - show modal with env dropdown
  if (args.length === 0) {
    try {
      await queueModal.showModal({ client, command });
    } catch (error) {
      console.error('Error opening queue modal:', error);
      await respond({
        text: 'Failed to open interactive dialog. Please try again.',
        response_type: 'ephemeral'
      });
    }
    return;
  }

  // Parse and validate environment
  const env = normalizeEnvironment(args[0].toLowerCase());

  if (!isValidEnvironment(env)) {
    await respond({
      text: `Invalid environment "${args[0]}". Type \`/claim help\` for usage.`,
      response_type: 'ephemeral'
    });
    return;
  }

  // Case 2: Only env provided - show modal with services
  if (args.length === 1) {
    try {
      await queueModal.showModalWithEnv({ client, command, env });
    } catch (error) {
      console.error('Error opening queue modal with env:', error);
      await respond({
        text: 'Failed to open interactive dialog. Please try again.',
        response_type: 'ephemeral'
      });
    }
    return;
  }

  // Case 3: Direct queue with full args
  if (args.length < 3) {
    await respond({
      text: `Usage: \`/claim queue <environment> <service1,service2,...> <task description>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\nTip: Use commas to queue for multiple services at once\n\nOr use \`/claim queue\` or \`/claim queue <env>\` for an interactive menu!\n\nType \`/claim help\` for more options!`,
      response_type: 'ephemeral'
    });
    return;
  }

  const serviceNames = args[1].split(',').map(s => s.trim());
  const task = args.slice(2).join(' ');

  // Validate all services first
  const invalidServices = serviceNames.filter(name => !isValidService(name));
  if (invalidServices.length > 0) {
    await respond({
      text: `Invalid service(s): ${invalidServices.join(', ')}\nAvailable services: ${SERVICES.join(', ')}`,
      response_type: 'ephemeral'
    });
    return;
  }

  // Process queue using shared business logic
  const { queued, available, alreadyQueued } = queueModal.processQueue(
    environments,
    env,
    serviceNames,
    userId,
    task
  );

  // Build response message
  let message = `<@${userId}>:\n`;

  if (queued.length > 0) {
    message += `⏳ *Added to queue in ${env}*:\n`;
    queued.forEach(q => {
      message += `  • ${q.name} (position ${q.position})\n`;
    });
  }

  if (available.length > 0) {
    message += `\n💡 *Available (use /claim instead)*: ${available.join(', ')}`;
  }

  if (alreadyQueued.length > 0) {
    message += `\nℹ️ *Already in queue*: ${alreadyQueued.join(', ')}`;
  }

  if (queued.length > 0) {
    message += `\n\n📋 Task: ${task}`;
  }

  await say({
    text: message.trim(),
    response_type: 'in_channel'
  });
};
