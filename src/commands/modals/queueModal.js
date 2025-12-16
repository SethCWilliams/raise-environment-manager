const { SERVICES, ENVIRONMENT_NAMES } = require('../../config');
const { getService, isValidService } = require('../../utils/helpers');
const { saveServiceToDB } = require('../../database/db');

/**
 * Show modal with environment dropdown (for /claim queue with no args)
 */
async function showModal({ client, command }) {
  const envOptions = ENVIRONMENT_NAMES.map(env => ({
    text: {
      type: 'plain_text',
      text: env.charAt(0).toUpperCase() + env.slice(1)
    },
    value: env
  }));

  const serviceOptions = SERVICES.map(service => ({
    text: { type: 'plain_text', text: service },
    value: service
  }));

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'queue_modal_with_env',
        private_metadata: JSON.stringify({ channel_id: command.channel_id }),
        title: { type: 'plain_text', text: 'Join Queue' },
        submit: { type: 'plain_text', text: 'Join Queue' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Join the queue for busy services. You\'ll automatically claim when they become available.'
            }
          },
          {
            type: 'input',
            block_id: 'env_block',
            label: { type: 'plain_text', text: 'Environment' },
            element: {
              type: 'static_select',
              action_id: 'env_select',
              options: envOptions,
              initial_option: envOptions[0]
            }
          },
          {
            type: 'input',
            block_id: 'services_block',
            label: { type: 'plain_text', text: 'Select Services' },
            element: {
              type: 'multi_static_select',
              action_id: 'services_selected',
              options: serviceOptions,
              placeholder: { type: 'plain_text', text: 'Choose services...' }
            }
          },
          {
            type: 'input',
            block_id: 'task_block',
            label: { type: 'plain_text', text: 'Task Description' },
            element: {
              type: 'plain_text_input',
              action_id: 'task_input',
              placeholder: { type: 'plain_text', text: 'What will you work on?' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening queue modal:', error);
    throw error;
  }
}

/**
 * Show modal with pre-selected environment (for /claim queue <env>)
 */
async function showModalWithEnv({ client, command, env }) {
  const serviceOptions = SERVICES.map(service => ({
    text: { type: 'plain_text', text: service },
    value: service
  }));

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'queue_modal',
        private_metadata: JSON.stringify({ env, channel_id: command.channel_id }),
        title: { type: 'plain_text', text: `Join Queue - ${env}` },
        submit: { type: 'plain_text', text: 'Join Queue' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Join the queue for busy services. You\'ll automatically claim when they become available.'
            }
          },
          {
            type: 'input',
            block_id: 'services_block',
            label: { type: 'plain_text', text: 'Select Services' },
            element: {
              type: 'multi_static_select',
              action_id: 'services_selected',
              options: serviceOptions,
              placeholder: { type: 'plain_text', text: 'Choose services...' }
            }
          },
          {
            type: 'input',
            block_id: 'task_block',
            label: { type: 'plain_text', text: 'Task Description' },
            element: {
              type: 'plain_text_input',
              action_id: 'task_input',
              placeholder: { type: 'plain_text', text: 'What will you work on?' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening queue modal with env:', error);
    throw error;
  }
}

/**
 * Process queue join for multiple services (shared logic)
 */
function processQueue(environments, env, serviceNames, userId, task) {
  const queued = [];
  const available = [];
  const alreadyQueued = [];

  for (const serviceName of serviceNames) {
    const service = getService(environments, env, serviceName);

    if (!service) {
      continue;
    }

    // Check if service is available
    if (!service.owner) {
      available.push(serviceName);
      continue;
    }

    // Check if user is already in queue
    const existingQueueEntry = service.queue.find(item => item.userId === userId);
    if (existingQueueEntry) {
      alreadyQueued.push(serviceName);
      continue;
    }

    // Add to queue
    service.queue.push({ userId, task });
    const position = service.queue.length;
    queued.push({ name: serviceName, position });
    saveServiceToDB(env, serviceName, service);
  }

  return { queued, available, alreadyQueued };
}

/**
 * Register modal view handlers
 */
function registerHandlers(app, environments) {
  // Handler for modal with environment picker
  app.view('queue_modal_with_env', async ({ ack, view, client, body }) => {
    await ack();

    const { channel_id } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract environment selection
    const envBlock = view.state.values.env_block.env_select;
    const env = envBlock.selected_option.value;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      return;
    }

    const serviceNames = selectedServices.map(opt => opt.value);

    // Extract task description
    const task = view.state.values.task_block.task_input.value;

    // Process queue
    const { queued, available, alreadyQueued } = processQueue(
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
        message += `  • ${q.name} (${env}, position ${q.position})\n`;
      });
    }

    if (available.length > 0) {
      const availableText = available.map(s => `${s} (${env})`).join(', ');
      message += `\n💡 *Available (use /claim instead)*: ${availableText}`;
    }

    if (alreadyQueued.length > 0) {
      const alreadyQueuedText = alreadyQueued.map(s => `${s} (${env})`).join(', ');
      message += `\nℹ️ *Already in queue*: ${alreadyQueuedText}`;
    }

    if (queued.length > 0) {
      message += `\n\n📋 Task: ${task}`;
    }

    // Post message to channel
    try {
      await client.chat.postMessage({
        channel: channel_id,
        text: message.trim()
      });
    } catch (error) {
      console.error('Error posting message:', error);
    }
  });

  // Handler for modal with pre-selected environment
  app.view('queue_modal', async ({ ack, view, client, body }) => {
    await ack();

    const { env, channel_id } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      return;
    }

    const serviceNames = selectedServices.map(opt => opt.value);

    // Extract task description
    const task = view.state.values.task_block.task_input.value;

    // Process queue
    const { queued, available, alreadyQueued } = processQueue(
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
        message += `  • ${q.name} (${env}, position ${q.position})\n`;
      });
    }

    if (available.length > 0) {
      const availableText = available.map(s => `${s} (${env})`).join(', ');
      message += `\n💡 *Available (use /claim instead)*: ${availableText}`;
    }

    if (alreadyQueued.length > 0) {
      const alreadyQueuedText = alreadyQueued.map(s => `${s} (${env})`).join(', ');
      message += `\nℹ️ *Already in queue*: ${alreadyQueuedText}`;
    }

    if (queued.length > 0) {
      message += `\n\n📋 Task: ${task}`;
    }

    // Post message to channel
    try {
      await client.chat.postMessage({
        channel: channel_id,
        text: message.trim()
      });
    } catch (error) {
      console.error('Error posting message:', error);
    }
  });
}

module.exports = {
  showModal,
  showModalWithEnv,
  processQueue,
  registerHandlers
};
