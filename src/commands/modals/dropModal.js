const { ENVIRONMENT_NAMES } = require('../../config');
const { processRelease } = require('../../utils/serviceOperations');

/**
 * Show modal with environment dropdown (for /claim drop with no args)
 */
async function showModal({ client, command, userId, environments }) {
  const envOptions = ENVIRONMENT_NAMES.map(env => ({
    text: {
      type: 'plain_text',
      text: env.charAt(0).toUpperCase() + env.slice(1) // Capitalize first letter
    },
    value: env
  }));

  // Get all owned services across all environments
  const allOwnedServices = {};
  for (const envName of ENVIRONMENT_NAMES) {
    const ownedInEnv = Object.keys(environments[envName].services).filter(serviceName => {
      const service = environments[envName].services[serviceName];
      return service.owner === userId;
    });
    allOwnedServices[envName] = ownedInEnv;
  }

  // Check if user owns any services
  const hasAnyServices = Object.values(allOwnedServices).some(services => services.length > 0);

  if (!hasAnyServices) {
    throw new Error('NO_OWNED_SERVICES');
  }

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'drop_modal_with_env',
        private_metadata: JSON.stringify({
          channel_id: command.channel_id,
          all_owned: allOwnedServices
        }),
        title: { type: 'plain_text', text: 'Release Service' },
        submit: { type: 'plain_text', text: 'Release' },
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
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '_Note: Only your services for the selected environment will be released._'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening drop modal:', error);
    throw error;
  }
}

/**
 * Show modal with owned services for specific environment (for /claim drop <env>)
 */
async function showModalWithEnv({ client, command, env, userId, environments }) {
  // Get services owned by user in this environment
  const ownedServices = Object.keys(environments[env].services).filter(serviceName => {
    const service = environments[env].services[serviceName];
    return service.owner === userId;
  });

  if (ownedServices.length === 0) {
    throw new Error('NO_OWNED_SERVICES_IN_ENV');
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

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'drop_modal',
        private_metadata: JSON.stringify({
          env,
          channel_id: command.channel_id,
          all_owned: ownedServices
        }),
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
              type: 'multi_static_select',
              action_id: 'services_selected',
              options: serviceOptions,
              placeholder: { type: 'plain_text', text: 'Choose services...' }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error opening drop modal with env:', error);
    throw error;
  }
}

/**
 * Register modal view handlers
 */
function registerHandlers(app, environments) {
  // Handler for modal with environment picker (simplified - just shows message)
  app.view('drop_modal_with_env', async ({ ack, view, client, body }) => {
    await ack();

    const { channel_id, all_owned } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract environment selection
    const envBlock = view.state.values.env_block.env_select;
    const env = envBlock.selected_option.value;

    // Get owned services for selected environment
    const serviceNames = all_owned[env] || [];

    if (serviceNames.length === 0) {
      try {
        await client.chat.postMessage({
          channel: channel_id,
          text: `You don't own any services in *${env}*.`
        });
      } catch (error) {
        console.error('Error posting message:', error);
      }
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

  // Handler for modal with pre-selected environment
  app.view('drop_modal', async ({ ack, view, client, body }) => {
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
}

module.exports = {
  showModal,
  showModalWithEnv,
  registerHandlers
};
