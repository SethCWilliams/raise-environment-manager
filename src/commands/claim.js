const { normalizeEnvironment, isValidEnvironment, getService, isChannelAllowed, isValidService } = require('../utils/helpers');
const { SERVICES } = require('../config');
const { saveServiceToDB } = require('../database/db');

module.exports = function(app, environments) {
  app.command('/claim', async ({ command, ack, say, respond, client }) => {
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

    // If only environment is provided, show interactive modal
    if (args.length === 1 && args[0]) {
      const env = normalizeEnvironment(args[0].toLowerCase());

      if (!isValidEnvironment(env)) {
        await respond({
          text: `Invalid environment "${args[0]}". Available environments: staging (or s), dev (or d)`,
          response_type: 'ephemeral'
        });
        return;
      }

      // Create checkboxes for all services
      const serviceOptions = SERVICES.map(service => ({
        text: {
          type: 'plain_text',
          text: service
        },
        value: service
      }));

      // Open modal
      try {
        await client.views.open({
          trigger_id: command.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'claim_modal',
            private_metadata: JSON.stringify({ env, channel_id: command.channel_id }),
            title: {
              type: 'plain_text',
              text: `Claim - ${env}`
            },
            submit: {
              type: 'plain_text',
              text: 'Claim'
            },
            blocks: [
              {
                type: 'input',
                block_id: 'services_block',
                label: {
                  type: 'plain_text',
                  text: 'Select Services'
                },
                element: {
                  type: 'checkboxes',
                  action_id: 'services_selected',
                  options: serviceOptions
                }
              },
              {
                type: 'input',
                block_id: 'task_block',
                label: {
                  type: 'plain_text',
                  text: 'Task Description'
                },
                element: {
                  type: 'plain_text_input',
                  action_id: 'task_input',
                  placeholder: {
                    type: 'plain_text',
                    text: 'What are you working on?'
                  }
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

    if (args.length < 3) {
      await respond({
        text: `Usage: \`/claim <environment> <service1,service2,...> <task description>\`\nEnvironments: staging (or s), dev (or d)\nServices: ${SERVICES.join(', ')}\nTip: Use commas to claim multiple services at once\n\n💡 *Quick tip*: Type \`/claim s\` or \`/claim d\` for an interactive menu!`,
        response_type: 'ephemeral'
      });
      return;
    }

    const env = normalizeEnvironment(args[0].toLowerCase());
    const serviceNames = args[1].split(',').map(s => s.trim());
    const task = args.slice(2).join(' ');
    const userId = command.user_id;

    if (!isValidEnvironment(env)) {
      await respond({
        text: `Invalid environment "${args[0]}". Available environments: staging (or s), dev (or d)`,
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
    const queued = [];
    const alreadyInQueue = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (service.owner) {
        // Service is claimed, try to add to queue
        const alreadyQueued = service.queue.find(item => item.userId === userId);
        if (alreadyQueued) {
          alreadyInQueue.push(serviceName);
        } else {
          service.queue.push({ userId, task });
          queued.push({ name: serviceName, position: service.queue.length });
          saveServiceToDB(env, serviceName, service);
        }
      } else {
        // Service is available, claim it
        service.owner = userId;
        service.task = task;
        service.startTime = Date.now();
        claimed.push(serviceName);
        saveServiceToDB(env, serviceName, service);
      }
    }

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

    message += `\n📋 Task: ${task}`;

    await say({
      text: message,
      response_type: 'in_channel'
    });
  });

  // Handle claim modal submission
  app.view('claim_modal', async ({ ack, view, client, body }) => {
    await ack();

    const { env, channel_id } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      // Note: This validation should ideally happen before ack, but Slack's API
      // makes it tricky. Users will just not see a confirmation if no services selected.
      return;
    }

    const serviceNames = selectedServices.map(opt => opt.value);

    // Extract task description
    const task = view.state.values.task_block.task_input.value;

    // Process each service (same logic as text command)
    const claimed = [];
    const queued = [];
    const alreadyInQueue = [];

    for (const serviceName of serviceNames) {
      const service = getService(environments, env, serviceName);

      if (service.owner) {
        // Service is claimed, try to add to queue
        const alreadyQueued = service.queue.find(item => item.userId === userId);
        if (alreadyQueued) {
          alreadyInQueue.push(serviceName);
        } else {
          service.queue.push({ userId, task });
          queued.push({ name: serviceName, position: service.queue.length });
          saveServiceToDB(env, serviceName, service);
        }
      } else {
        // Service is available, claim it
        service.owner = userId;
        service.task = task;
        service.startTime = Date.now();
        claimed.push(serviceName);
        saveServiceToDB(env, serviceName, service);
      }
    }

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

    message += `\n📋 Task: ${task}`;

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
