const { formatDuration } = require('../../utils/helpers');

module.exports = async function({ respond }, environments, args) {
  let message = '*Environment Status (In Use)*\n\n';
  let hasInUseServices = false;

  for (const [envName, env] of Object.entries(environments)) {
    const inUseServices = Object.entries(env.services).filter(([_, service]) => service.owner);

    if (inUseServices.length > 0) {
      hasInUseServices = true;
      message += `━━━ *${envName.toUpperCase()}* ━━━\n`;

      for (const [serviceName, service] of inUseServices) {
        message += `\n*${serviceName}*\n`;
        const duration = formatDuration(service.startTime);
        message += `  • Owner: <@${service.owner}>\n`;
        message += `  • Task: ${service.task}\n`;
        message += `  • Duration: ${duration}\n`;

        if (service.queue.length > 0) {
          message += `  • Queue (${service.queue.length}):\n`;
          service.queue.forEach((item, index) => {
            message += `    ${index + 1}. <@${item.userId}> - ${item.task}\n`;
          });
        }
      }

      message += '\n';
    }
  }

  if (!hasInUseServices) {
    message += '_All services are currently available!_';
  }

  await respond({
    text: message,
    response_type: 'ephemeral'
  });
};
