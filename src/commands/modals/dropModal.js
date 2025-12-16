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

  // Build service options with environment prefix
  const serviceOptions = [];
  for (const [envName, services] of Object.entries(allOwnedServices)) {
    services.forEach(serviceName => {
      serviceOptions.push({
        text: {
          type: 'plain_text',
          text: `${envName} - ${serviceName}`
        },
        value: `${envName}:${serviceName}`
      });
    });
  }

  // Add "Release All" option for each environment
  ENVIRONMENT_NAMES.forEach(envName => {
    if (allOwnedServices[envName] && allOwnedServices[envName].length > 0) {
      serviceOptions.unshift({
        text: {
          type: 'plain_text',
          text: `🔓 Release All in ${envName}`
        },
        value: `__RELEASE_ALL__:${envName}`
      });
    }
  });

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
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Select which services to release:'
            }
          },
          {
            type: 'input',
            block_id: 'services_block',
            label: {
              type: 'plain_text',
              text: 'Services to Release'
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
  // Handler for modal with environment picker
  app.view('drop_modal_with_env', async ({ ack, view, client, body }) => {
    await ack();

    const { channel_id, all_owned } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      return;
    }

    // Group selected services by environment
    const servicesByEnv = {};

    selectedServices.forEach(opt => {
      const value = opt.value;

      // Check if it's a "Release All" option
      if (value.startsWith('__RELEASE_ALL__:')) {
        const env = value.split(':')[1];
        servicesByEnv[env] = all_owned[env] || [];
      } else {
        // Parse "env:service" format
        const [env, serviceName] = value.split(':');
        if (!servicesByEnv[env]) {
          servicesByEnv[env] = [];
        }
        servicesByEnv[env].push(serviceName);
      }
    });

    // Process releases for each environment
    const allReleased = [];
    const allAutoClaimed = [];
    const allNotOwned = [];

    for (const [env, serviceNames] of Object.entries(servicesByEnv)) {
      if (serviceNames.length === 0) continue;

      const { released, notOwned, autoClaimed } = processRelease(
        environments,
        env,
        serviceNames,
        userId
      );

      allReleased.push(...released.map(r => ({ ...r, env })));
      allAutoClaimed.push(...autoClaimed.map(ac => ({ ...ac, env })));
      allNotOwned.push(...notOwned.map(n => ({ ...n, env })));
    }

    // Build response message
    let message = `<@${userId}>:\n`;

    if (allReleased.length > 0) {
      const releasedText = allReleased.map(r => `${r.name} (${r.env}, ${r.duration})`).join(', ');
      message += `✅ *Released*: ${releasedText}\n`;
    }

    if (allAutoClaimed.length > 0) {
      message += `\n*Auto-claimed from queue:*\n`;
      allAutoClaimed.forEach(ac => {
        message += `• ${ac.name} (${ac.env}) → <@${ac.nextUser}> (${ac.task})\n`;
      });
    }

    if (allNotOwned.length > 0) {
      const notOwnedText = allNotOwned.map(n => `${n.name} (${n.env}, ${n.reason})`).join(', ');
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
      const releasedText = released.map(r => `${r.name} (${env}, ${r.duration})`).join(', ');
      message += `✅ *Released*: ${releasedText}\n`;
    }

    if (autoClaimed.length > 0) {
      message += `\n*Auto-claimed from queue:*\n`;
      autoClaimed.forEach(ac => {
        message += `• ${ac.name} (${env}) → <@${ac.nextUser}> (${ac.task})\n`;
      });
    }

    if (notOwned.length > 0) {
      const notOwnedText = notOwned.map(n => `${n.name} (${env}, ${n.reason})`).join(', ');
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
