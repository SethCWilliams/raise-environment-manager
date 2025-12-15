const { normalizeEnvironment, isValidEnvironment, getService, isValidService } = require('../../utils/helpers');
const { SERVICES } = require('../../config');
const { saveServiceToDB } = require('../../database/db');

module.exports = async function({ command, say, respond }, environments, args) {
  const userId = command.user_id;

  if (args.length < 3) {
    await respond({
      text: `Usage: \`/claim prioritize <environment> <service1,service2,...> <task description>\`\nEnvironments: Use shortcuts or full names\nServices: ${SERVICES.join(', ')}\n\n⚡ This command immediately claims the service for urgent work.\nThe current owner is moved to queue position 1.\nUse this for critical hotfixes and production issues.\n\nType \`/claim help\` for more options!`,
      response_type: 'ephemeral'
    });
    return;
  }

  const env = normalizeEnvironment(args[0].toLowerCase());
  const serviceNames = args[1].split(',').map(s => s.trim());
  const task = args.slice(2).join(' ');

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
  const claimed = [];
  const takenOver = [];
  const alreadyOwned = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    if (!service.owner) {
      // Service is available, claim it immediately
      service.owner = userId;
      service.task = task;
      service.startTime = Date.now();
      claimed.push(serviceName);
      saveServiceToDB(env, serviceName, service);
    } else if (service.owner === userId) {
      // User already owns this service
      alreadyOwned.push(serviceName);
    } else {
      // Service is claimed by someone else - TAKE IT OVER
      const previousOwner = service.owner;
      const previousTask = service.task;

      // Remove user from queue if they're already in it
      const existingIndex = service.queue.findIndex(item => item.userId === userId);
      if (existingIndex !== -1) {
        service.queue.splice(existingIndex, 1);
      }

      // Add previous owner to front of queue
      service.queue.unshift({ userId: previousOwner, task: previousTask });

      // Claim the service for the new user
      service.owner = userId;
      service.task = task;
      service.startTime = Date.now();

      takenOver.push(serviceName);
      saveServiceToDB(env, serviceName, service);
    }
  }

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
