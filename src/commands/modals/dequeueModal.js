const { ENVIRONMENT_NAMES } = require('../../config');
const { getService } = require('../../utils/helpers');
const { saveServiceToDB } = require('../../database/db');

/**
 * Show modal with all queues the user is in
 */
async function showModal({ client, command, userId, environments }) {
  // Find all services where user is queued
  const queuedServices = [];

  for (const envName of ENVIRONMENT_NAMES) {
    for (const [serviceName, service] of Object.entries(environments[envName].services)) {
      const queuePosition = service.queue.findIndex(item => item.userId === userId);
      if (queuePosition !== -1) {
        queuedServices.push({
          env: envName,
          service: serviceName,
          position: queuePosition + 1,
          task: service.queue[queuePosition].task
        });
      }
    }
  }

  if (queuedServices.length === 0) {
    throw new Error('NOT_IN_ANY_QUEUE');
  }

  // Create checkboxes grouped by environment
  const serviceOptions = queuedServices.map(qs => ({
    text: {
      type: 'plain_text',
      text: `${qs.env} - ${qs.service} (position ${qs.position})`
    },
    value: `${qs.env}:${qs.service}`,
    description: {
      type: 'plain_text',
      text: qs.task.length > 50 ? qs.task.substring(0, 47) + '...' : qs.task
    }
  }));

  // Add "Dequeue All" option
  serviceOptions.unshift({
    text: {
      type: 'plain_text',
      text: '🔓 Dequeue from All'
    },
    value: '__DEQUEUE_ALL__'
  });

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'dequeue_modal',
        private_metadata: JSON.stringify({
          channel_id: command.channel_id,
          all_queued: queuedServices
        }),
        title: {
          type: 'plain_text',
          text: 'Leave Queue'
        },
        submit: {
          type: 'plain_text',
          text: 'Dequeue'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `You're in *${queuedServices.length}* queue(s). Select which to leave:`
            }
          },
          {
            type: 'input',
            block_id: 'services_block',
            label: {
              type: 'plain_text',
              text: 'Your Queues'
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
    console.error('Error opening dequeue modal:', error);
    throw error;
  }
}

/**
 * Register modal view handler
 */
function registerHandlers(app, environments) {
  app.view('dequeue_modal', async ({ ack, view, client, body }) => {
    await ack();

    const { channel_id, all_queued } = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // Extract selected services
    const servicesBlock = view.state.values.services_block.services_selected;
    const selectedServices = servicesBlock.selected_options || [];

    if (selectedServices.length === 0) {
      return;
    }

    let servicesToDequeue;

    // Check if "Dequeue All" was selected
    const dequeueAllSelected = selectedServices.some(opt => opt.value === '__DEQUEUE_ALL__');
    if (dequeueAllSelected) {
      servicesToDequeue = all_queued;
    } else {
      // Parse selected services (format: "env:service")
      servicesToDequeue = selectedServices
        .filter(opt => opt.value !== '__DEQUEUE_ALL__')
        .map(opt => {
          const [env, service] = opt.value.split(':');
          return all_queued.find(qs => qs.env === env && qs.service === service);
        })
        .filter(Boolean);
    }

    // Remove from queues
    const removed = [];
    const failed = [];

    for (const qs of servicesToDequeue) {
      const service = getService(environments, qs.env, qs.service);
      if (!service) continue;

      const queueIndex = service.queue.findIndex(item => item.userId === userId);
      if (queueIndex !== -1) {
        service.queue.splice(queueIndex, 1);
        removed.push(`${qs.env} - ${qs.service}`);
        saveServiceToDB(qs.env, qs.service, service);
      } else {
        failed.push(`${qs.env} - ${qs.service}`);
      }
    }

    // Build response message
    let message = '';

    if (removed.length > 0) {
      message += `✅ Removed from queue:\n`;
      removed.forEach(r => {
        message += `  • ${r}\n`;
      });
    }

    if (failed.length > 0) {
      message += `\n⚠️ Could not remove (no longer in queue):\n`;
      failed.forEach(f => {
        message += `  • ${f}\n`;
      });
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
  registerHandlers
};
