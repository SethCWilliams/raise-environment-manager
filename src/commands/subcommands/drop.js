const { normalizeEnvironment, isValidEnvironment, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { processRelease } = require('../../utils/serviceOperations');
const dropModal = require('../modals/dropModal');

module.exports = async function({ command, say, respond, client }, environments, args) {
  const userId = command.user_id;

  // Case 1: No args - show modal with env dropdown
  if (args.length === 0) {
    try {
      await dropModal.showModal({ client, command, userId, environments });
    } catch (error) {
      if (error.message === 'NO_OWNED_SERVICES') {
        await respond({
          text: `You don't own any services in any environment.`,
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

  // Parse and validate environment
  const env = normalizeEnvironment(args[0].toLowerCase());

  if (!isValidEnvironment(env)) {
    await respond({
      text: `Invalid environment "${args[0]}". Type \`/claim help\` for usage.`,
      response_type: 'ephemeral'
    });
    return;
  }

  // Case 2: Only env provided - show modal with owned services
  if (args.length === 1) {
    try {
      await dropModal.showModalWithEnv({ client, command, env, userId, environments });
    } catch (error) {
      if (error.message === 'NO_OWNED_SERVICES_IN_ENV') {
        await respond({
          text: `You don't own any services in *${env}*.`,
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

  // Case 3: Env + services provided - direct release
  const serviceNames = args[1].split(',').map(s => s.trim());

  // Validate all services first
  const invalidServices = serviceNames.filter(name => !isValidService(name));
  if (invalidServices.length > 0) {
    await respond({
      text: `Invalid service(s): ${invalidServices.join(', ')}\nAvailable services: ${SERVICES.join(', ')}`,
      response_type: 'ephemeral'
    });
    return;
  }

  // Process release using shared business logic
  const { released, notOwned, autoClaimed } = processRelease(
    environments,
    env,
    serviceNames,
    userId
  );

  // Build response message
  let message = `<@${userId}>:\n`;

  if (released.length > 0) {
    const releasedText = released.map(r => `${r.name} (${env}, ${r.duration})`).join(', ');
    message += `✅ *Released*: ${releasedText}\n`;
  }

  if (autoClaimed.length > 0) {
    message += `\n*Auto-claimed from queue:*\n`;
    autoClaimed.forEach(ac => {
      message += `• ${ac.name} (${env}) → <@${ac.nextUser}> (${ac.task})\n`;
    });
  }

  if (notOwned.length > 0) {
    const notOwnedText = notOwned.map(n => `${n.name} (${env}, ${n.reason})`).join(', ');
    message += `\n⚠️ *Could not release*: ${notOwnedText}`;
  }

  await say({
    text: message,
    response_type: 'in_channel'
  });
};
