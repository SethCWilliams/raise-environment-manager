const { normalizeEnvironment, isValidEnvironment, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { processForceRelease } = require('../../utils/serviceOperations');

module.exports = async function({ command, say, respond }, environments, args) {
  const userId = command.user_id;

  if (args.length < 2) {
    await respond({
      text: `Usage: \`/claim force-drop <environment> <service1,service2,...>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\nTip: Use commas to force-drop multiple services at once\n\nType \`/claim help\` for more options!`,
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

  // Process force-release using shared business logic
  const { released, notClaimed, autoClaimed } = processForceRelease(
    environments,
    env,
    serviceNames,
    userId
  );

  // Build message
  let message = `<@${userId}> force-released:\n`;

  if (released.length > 0) {
    released.forEach(r => {
      message += `• ${r.name} (was owned by <@${r.previousOwner}> for ${r.duration})\n`;
    });
  }

  if (autoClaimed.length > 0) {
    message += '\n*Auto-claimed from queue:*\n';
    autoClaimed.forEach(ac => {
      message += `• ${ac.name} → <@${ac.nextUser}> (${ac.task})\n`;
    });
  }

  if (notClaimed.length > 0) {
    message += `\n⚠️ *Not claimed*: ${notClaimed.join(', ')}`;
  }

  await say({
    text: message,
    response_type: 'in_channel'
  });
};
