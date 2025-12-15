const { normalizeEnvironment, isValidEnvironment, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const prioritizeModal = require('../modals/prioritizeModal');

module.exports = async function({ command, say, respond, client }, environments, args) {
  const userId = command.user_id;

  // Case 1: No args - show modal with env dropdown
  if (args.length === 0) {
    try {
      await prioritizeModal.showModal({ client, command });
    } catch (error) {
      console.error('Error opening prioritize modal:', error);
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
      await prioritizeModal.showModalWithEnv({ client, command, env });
    } catch (error) {
      console.error('Error opening prioritize modal with env:', error);
      await respond({
        text: 'Failed to open interactive dialog. Please try again.',
        response_type: 'ephemeral'
      });
    }
    return;
  }

  // Case 3: Direct prioritize with full args
  if (args.length < 3) {
    await respond({
      text: `Usage: \`/claim prioritize <environment> <service1,service2,...> <task description>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\n\nOr use \`/claim prioritize\` or \`/claim prioritize <env>\` for an interactive menu!\n\n⚡ This command immediately claims the service for urgent work.\nThe current owner is moved to queue position 1.\nUse this for critical hotfixes and production issues.\n\nType \`/claim help\` for more options!`,
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

  // Process prioritize using shared business logic
  const { claimed, takenOver, alreadyOwned } = prioritizeModal.processPrioritize(
    environments,
    env,
    serviceNames,
    userId,
    task
  );

  // Build response message
  let message = `<@${userId}>:\n`;

  if (claimed.length > 0) {
    message += `✅ *Claimed* (service was available): ${claimed.join(', ')}\n`;
  }

  if (takenOver.length > 0) {
    message += `⚡ *PRIORITY TAKEOVER*: ${takenOver.join(', ')}\n`;
    message += `   Previous owner moved to queue position 1\n`;
  }

  if (alreadyOwned.length > 0) {
    message += `ℹ️ *Already owned by you*: ${alreadyOwned.join(', ')}\n`;
  }

  message += `\n🔥 Task: ${task}`;

  await say({
    text: message,
    response_type: 'in_channel'
  });
};
