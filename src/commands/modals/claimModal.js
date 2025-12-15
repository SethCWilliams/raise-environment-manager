const { SERVICES, ENVIRONMENT_NAMES } = require('../../config');
const { processClaim } = require('../../utils/serviceOperations');

/**
 * Show modal with environment dropdown (for /claim with no args)
 */
async function showModal({ client, command }) {
  const envOptions = ENVIRONMENT_NAMES.map(env => ({
    text: {
      type: 'plain_text',
      text: env.charAt(0).toUpperCase() + env.slice(1) // Capitalize first letter
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
        callback_id: 'claim_modal_with_env',
        private_metadata: JSON.stringify({ channel_id: command.channel_id }),
        title: { type: 'plain_text', text: 'Claim Service' },
        submit: { type: 'plain_text', text: 'Claim' },
        blocks: [
          {
            type: 'input',
            block_id: 'env_block',
            label: { type: 'plain_text', text: 'Environment' },
            element: {
              type: 'static_select',
              action_id: 'env_select',
              options: envOptions,
              initial_option: envOptions[0] // Default to first environment
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
              placeholder: { type: 'plain_text', text: 'What are you working on?' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening claim modal:', error);
    throw error;
  }
}

/**
 * Show modal with pre-selected environment (for /claim <env>)
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
        callback_id: 'claim_modal',
        private_metadata: JSON.stringify({ env, channel_id: command.channel_id }),
        title: { type: 'plain_text', text: `Claim - ${env}` },
        submit: { type: 'plain_text', text: 'Claim' },
        blocks: [
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
              placeholder: { type: 'plain_text', text: 'What are you working on?' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening claim modal with env:', error);
    throw error;
  }
}

/**
 * Register modal view handlers
 */
function registerHandlers(app, environments) {
  // Handler for modal with environment picker
  app.view('claim_modal_with_env', async ({ ack, view, client, body }) => {
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
  app.view('claim_modal', async ({ ack, view, client, body }) => {
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
  registerHandlers
};
