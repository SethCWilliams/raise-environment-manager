const { isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { processClaim } = require('../../utils/serviceOperations');

module.exports = async function({ command, say, respond }, environments, { env, args }) {
  const userId = command.user_id;

  if (args.length < 2) {
    await respond({
      text: `Usage: \`/claim <environment> <service1,service2,...> <task description>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\nTip: Use commas to claim multiple services at once\n\nType \`/claim help\` for more options!`,
      response_type: 'ephemeral'
    });
    return;
  }

  const serviceNames = args[0].split(',').map(s => s.trim());
  const task = args.slice(1).join(' ');

  // Validate all services first
  const invalidServices = serviceNames.filter(name => !isValidService(name));
  if (invalidServices.length > 0) {
    await respond({
      text: `Invalid service(s): ${invalidServices.join(', ')}\nAvailable services: ${SERVICES.join(', ')}`,
      response_type: 'ephemeral'
    });
    return;
  }

  // Process claim using shared business logic
  const { claimed, queued, alreadyInQueue, alreadyOwned } = processClaim(
    environments,
    env,
    serviceNames,
    userId,
    task
  );

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

  if (alreadyOwned.length > 0) {
    message += `ℹ️ *Already owned by you*: ${alreadyOwned.join(', ')}\n`;
  }

  message += `\n📋 Task: ${task}`;

  await say({
    text: message,
    response_type: 'in_channel'
  });
};
