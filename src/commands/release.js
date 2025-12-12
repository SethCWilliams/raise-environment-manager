const { normalizeEnvironment, isValidEnvironment, getService, isChannelAllowed, isValidService, formatDuration } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/release', async ({ command, ack, say, respond, client }) => {
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
    if (args.length < 1 || !args[0]) {
      await respond({
        text: `Usage: \`/release <environment> [service1,service2,...]\`\nEnvironments: staging (or s), dev (or d)\nTip: Omit services to release ALL your services in that environment\n\n💡 *Quick tip*: Type \`/release s\` or \`/release d\` for an interactive menu!`,
        response_type: 'ephemeral'
      });
      return;
    }

    const env = normalizeEnvironment(args[0].toLowerCase());
    const userId = command.user_id;

    if (!isValidEnvironment(env)) {
      await respond({
        text: `Invalid environment "${args[0]}". Available environments: staging (or s), dev (or d)`,
        response_type: 'ephemeral'
      });
      return;
    }

    // If only environment is provided, show interactive modal
    if (args.length === 1) {
      // Get services owned by user in this environment
      const ownedServices = Object.keys(environments[env].services).filter(serviceName => {
        const service = environments[env].services[serviceName];
        return service.owner === userId;
      });

      if (ownedServices.length === 0) {
        await respond({
          text: `You don't own any services in *${env}*.`,
          response_type: 'ephemeral'
        });
        return;
      }

      // Create checkboxes for owned services
      const serviceOptions = ownedServices.map(service => ({
        text: {
          type: 'plain_text',
          text: service
        },
        value: service
      }));

      // Add "Release All" option
      serviceOptions.unshift({
        text: {
          type: 'plain_text',
          text: '🔓 Release All'
        },
        value: '__RELEASE_ALL__'
      });

      // Open modal
      try {
        await client.views.open({
          trigger_id: command.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'release_modal',
            private_metadata: JSON.stringify({ env, channel_id: command.channel_id, all_owned: ownedServices }),
            title: {
              type: 'plain_text',
              text: `Release - ${env}`
            },
            submit: {
              type: 'plain_text',
              text: 'Release'
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `Select services to release in *${env}*:`
                }
              },
              {
                type: 'input',
                block_id: 'services_block',
                label: {
                  type: 'plain_text',
                  text: 'Your Services'
                },
                element: {
                  type: 'checkboxes',
                  action_id: 'services_selected',
                  options: serviceOptions
                }
              }
            ]
          }
        });
      } catch (error) {
        console.error('Error opening modal:', error);
        await respond({
          text: 'Failed to open interactive dialog. Please try again.',
          response_type: 'ephemeral'
        });
      }
      return;
    }

    let serviceNames;

    // If no services specified, release all services owned by user in this environment
    if (args.length < 2 || !args[1]) {
      serviceNames = Object.keys(environments[env].services).filter(serviceName => {
        const service = environments[env].services[serviceName];
        return service.owner === userId;
      });

      if (serviceNames.length === 0) {
        await respond({
          text: `You don't own any services in *${env}*.`,
          response_type: 'ephemeral'
        });
        return;
      }
    } else {
      // Parse comma-separated service names
      serviceNames = args[1].split(',').map(s => s.trim());

      // Validate all services first
      const invalidServices = serviceNames.filter(name => !isValidService(name));
      if (invalidServices.length > 0) {
        await respond({
          text: `Invalid service(s): ${invalidServices.join(', ')}\nAvailable services: ${SERVICES.join(', ')}`,
          response_type: 'ephemeral'
        });
        return;
      }
    }

    // Process each service
    const released = [];
    const notOwned = [];
    const autoClaimed = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (!service) {
        continue;
      }

      // Check if user owns this service
      if (service.owner !== userId) {
        if (!service.owner) {
          notOwned.push({ name: serviceName, reason: 'not claimed' });
        } else {
          notOwned.push({ name: serviceName, reason: 'owned by someone else' });
        }
        continue;
      }

      // Calculate duration
      const duration = formatDuration(service.startTime);
      released.push({ name: serviceName, duration });

      // Check if there's a queue and auto-claim for next person
      if (service.queue.length > 0) {
        const nextPerson = service.queue.shift();

        // Automatically claim for the next person
        service.owner = nextPerson.userId;
        service.task = nextPerson.task;
        service.startTime = Date.now();

        autoClaimed.push({
          name: serviceName,
          nextUser: nextPerson.userId,
          task: nextPerson.task
        });
        saveServiceToDB(env, serviceName, service);
      } else {
        // No queue, release the service
        service.owner = null;
        service.task = null;
        service.startTime = null;
        saveServiceToDB(env, serviceName, service);
      }
    }

    // Build response message
    let message = `<@${userId}>:\n`;

    if (released.length > 0) {
      const releasedText = released.map(r => `${r.name} (${r.duration})`).join(', ');
      message += `✅ *Released*: ${releasedText}\n`;
    }

    if (autoClaimed.length > 0) {
      message += `\n*Auto-claimed from queue:*\n`;
      autoClaimed.forEach(ac => {
        message += `• ${ac.name} → <@${ac.nextUser}> (${ac.task})\n`;
      });
    }

    if (notOwned.length > 0) {
      const notOwnedText = notOwned.map(n => `${n.name} (${n.reason})`).join(', ');
      message += `\n⚠️ *Could not release*: ${notOwnedText}`;
    }

    await say({
      text: message,
      response_type: 'in_channel'
    });
  });

  // Handle release modal submission
  app.view('release_modal', async ({ ack, view, client, body }) => {
    await ack();

    const { env, channel_id, all_owned } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      return;
    }

    let serviceNames;

    // Check if "Release All" was selected
    const releaseAllSelected = selectedServices.some(opt => opt.value === '__RELEASE_ALL__');
    if (releaseAllSelected) {
      serviceNames = all_owned;
    } else {
      serviceNames = selectedServices.map(opt => opt.value);
    }

    // Process each service (same logic as text command)
    const released = [];
    const notOwned = [];
    const autoClaimed = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (!service) {
        continue;
      }

      // Check if user owns this service
      if (service.owner !== userId) {
        if (!service.owner) {
          notOwned.push({ name: serviceName, reason: 'not claimed' });
        } else {
          notOwned.push({ name: serviceName, reason: 'owned by someone else' });
        }
        continue;
      }

      // Calculate duration
      const duration = formatDuration(service.startTime);
      released.push({ name: serviceName, duration });

      // Check if there's a queue and auto-claim for next person
      if (service.queue.length > 0) {
        const nextPerson = service.queue.shift();

        // Automatically claim for the next person
        service.owner = nextPerson.userId;
        service.task = nextPerson.task;
        service.startTime = Date.now();

        autoClaimed.push({
          name: serviceName,
          nextUser: nextPerson.userId,
          task: nextPerson.task
        });
        saveServiceToDB(env, serviceName, service);
      } else {
        // No queue, release the service
        service.owner = null;
        service.task = null;
        service.startTime = null;
        saveServiceToDB(env, serviceName, service);
      }
    }

    // Build response message
    let message = `<@${userId}>:\n`;

    if (released.length > 0) {
      const releasedText = released.map(r => `${r.name} (${r.duration})`).join(', ');
      message += `✅ *Released*: ${releasedText}\n`;
    }

    if (autoClaimed.length > 0) {
      message += `\n*Auto-claimed from queue:*\n`;
      autoClaimed.forEach(ac => {
        message += `• ${ac.name} → <@${ac.nextUser}> (${ac.task})\n`;
      });
    }

    if (notOwned.length > 0) {
      const notOwnedText = notOwned.map(n => `${n.name} (${n.reason})`).join(', ');
      message += `\n⚠️ *Could not release*: ${notOwnedText}`;
    }

    // Post message to channel
    try {
      await client.chat.postMessage({
        channel: channel_id,
        text: message
      });
    } catch (error) {
      console.error('Error posting message:', error);
    }
  });
};
