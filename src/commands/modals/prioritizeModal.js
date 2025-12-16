const { SERVICES, ENVIRONMENT_NAMES } = require('../../config');
const { normalizeEnvironment, isValidEnvironment, getService, isValidService } = require('../../utils/helpers');
const { saveServiceToDB } = require('../../database/db');

/**
 * Show modal with environment dropdown (for /claim prioritize with no args)
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
        callback_id: 'prioritize_modal_with_env',
        private_metadata: JSON.stringify({ channel_id: command.channel_id }),
        title: { type: 'plain_text', text: '⚡ Priority Claim' },
        submit: { type: 'plain_text', text: 'Take Over' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚠️ *Priority mode* immediately takes over services for urgent work.\nCurrent owners are moved to queue position 1.'
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
            label: { type: 'plain_text', text: 'Urgent Task Description' },
            element: {
              type: 'plain_text_input',
              action_id: 'task_input',
              placeholder: { type: 'plain_text', text: 'e.g., Production hotfix for login bug' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening prioritize modal:', error);
    throw error;
  }
}

/**
 * Show modal with pre-selected environment (for /claim prioritize <env>)
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
        callback_id: 'prioritize_modal',
        private_metadata: JSON.stringify({ env, channel_id: command.channel_id }),
        title: { type: 'plain_text', text: `⚡ Priority - ${env}` },
        submit: { type: 'plain_text', text: 'Take Over' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚠️ *Priority mode* immediately takes over services for urgent work.\nCurrent owners are moved to queue position 1.'
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
            label: { type: 'plain_text', text: 'Urgent Task Description' },
            element: {
              type: 'plain_text_input',
              action_id: 'task_input',
              placeholder: { type: 'plain_text', text: 'e.g., Production hotfix for login bug' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening prioritize modal with env:', error);
    throw error;
  }
}

/**
 * Process prioritize logic (shared between modal and direct command)
 */
function processPrioritize(environments, env, serviceNames, userId, task) {
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

  return { claimed, takenOver, alreadyOwned };
}

/**
 * Register modal view handlers
 */
function registerHandlers(app, environments) {
  // Handler for modal with environment picker
  app.view('prioritize_modal_with_env', async ({ ack, view, client, body }) => {
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

    // Process prioritize
    const { claimed, takenOver, alreadyOwned } = processPrioritize(
      environments,
      env,
      serviceNames,
      userId,
      task
    );

    // Build response message
    let message = `<@${userId}>:\n`;

    if (claimed.length > 0) {
      const claimedText = claimed.map(s => `${s} (${env})`).join(', ');
      message += `✅ *Claimed* (service was available): ${claimedText}\n`;
    }

    if (takenOver.length > 0) {
      const takenOverText = takenOver.map(s => `${s} (${env})`).join(', ');
      message += `⚡ *PRIORITY TAKEOVER*: ${takenOverText}\n`;
      message += `   Previous owner moved to queue position 1\n`;
    }

    if (alreadyOwned.length > 0) {
      const alreadyOwnedText = alreadyOwned.map(s => `${s} (${env})`).join(', ');
      message += `ℹ️ *Already owned by you*: ${alreadyOwnedText}\n`;
    }

    message += `\n🔥 Task: ${task}`;

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

  // Handler for modal with pre-selected environment
  app.view('prioritize_modal', async ({ ack, view, client, body }) => {
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

    // Process prioritize
    const { claimed, takenOver, alreadyOwned } = processPrioritize(
      environments,
      env,
      serviceNames,
      userId,
      task
    );

    // Build response message
    let message = `<@${userId}>:\n`;

    if (claimed.length > 0) {
      const claimedText = claimed.map(s => `${s} (${env})`).join(', ');
      message += `✅ *Claimed* (service was available): ${claimedText}\n`;
    }

    if (takenOver.length > 0) {
      const takenOverText = takenOver.map(s => `${s} (${env})`).join(', ');
      message += `⚡ *PRIORITY TAKEOVER*: ${takenOverText}\n`;
      message += `   Previous owner moved to queue position 1\n`;
    }

    if (alreadyOwned.length > 0) {
      const alreadyOwnedText = alreadyOwned.map(s => `${s} (${env})`).join(', ');
      message += `ℹ️ *Already owned by you*: ${alreadyOwnedText}\n`;
    }

    message += `\n🔥 Task: ${task}`;

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
}

module.exports = {
  showModal,
  showModalWithEnv,
  processPrioritize,
  registerHandlers
};
