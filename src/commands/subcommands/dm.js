/**
 * DM Test Subcommand
 * Sends a test DM with interactive buttons to the user
 */

const { processRelease } = require('../../utils/serviceOperations');
const { NOTIFICATION_CHANNEL } = require('../../config');

module.exports = async function({ command, respond, client }, environments, args) {
  const userId = command.user_id;

  try {
    // Open a DM conversation with the user
    const dmChannel = await client.conversations.open({
      users: userId
    });

    // Send a message with interactive buttons
    await client.chat.postMessage({
      channel: dmChannel.channel.id,
      text: 'Test message with buttons',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Test DM Message*\n\nThis is a test message to demonstrate DM functionality with interactive buttons. Please select an option below:'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Still in Use'
              },
              style: 'primary',
              action_id: 'dm_still_in_use'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Release'
              },
              style: 'danger',
              action_id: 'dm_release'
            }
          ]
        }
      ]
    });

    // Send ephemeral confirmation in the channel
    await respond({
      text: 'Test DM sent! Check your direct messages.',
      response_type: 'ephemeral'
    });

  } catch (error) {
    console.error('Error sending DM:', error);
    await respond({
      text: 'Failed to send DM. Please try again.',
      response_type: 'ephemeral'
    });
  }
};

/**
 * Register button action handlers
 * Call this function when setting up the Slack app
 */
module.exports.registerHandlers = function(app, environments) {
  // Handle "Still in Use" button click
  app.action('dm_still_in_use', async ({ ack, body, client }) => {
    await ack();

    try {
      // Update the message to show which button was clicked
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: 'Button clicked: Still in Use',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Test DM Message*\n\nThis is a test message to demonstrate DM functionality with interactive buttons. Please select an option below:'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *You clicked: Still in Use*'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Still in Use'
                },
                style: 'primary',
                action_id: 'dm_still_in_use'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Release'
                },
                style: 'danger',
                action_id: 'dm_release'
              }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error handling Still in Use button:', error);
    }
  });

  // Handle "Release" button click
  app.action('dm_release', async ({ ack, body, client }) => {
    await ack();

    try {
      // Update the message to show which button was clicked
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: 'Button clicked: Release',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Test DM Message*\n\nThis is a test message to demonstrate DM functionality with interactive buttons. Please select an option below:'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *You clicked: Release*'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Still in Use'
                },
                style: 'primary',
                action_id: 'dm_still_in_use'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Release'
                },
                style: 'danger',
                action_id: 'dm_release'
              }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error handling Release button:', error);
    }
  });

  // ============ REMINDER BUTTON HANDLERS ============

  // Handle "Still in Use" button from reminder DMs
  app.action('reminder_still_in_use', async ({ ack, body, client }) => {
    await ack();

    try {
      // Parse the button value to get context
      const { env, service: serviceName } = JSON.parse(body.actions[0].value);
      const userId = body.user.id;

      // Reset the timer for this service
      const environment = environments[env];
      if (environment && environment.services[serviceName]) {
        const service = environment.services[serviceName];

        if (service.owner === userId) {
          // Reset start time and clear reminder tracking
          service.startTime = Date.now();
          service.lastReminderSent = null;

          // Update the message to confirm
          await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'Still in use - timer reset',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:white_check_mark: *Timer reset for \`${serviceName}\` in \`${env}\`*\n\nYou'll get another reminder in 2 hours if you still have it.`
                }
              }
            ]
          });

          console.log(`⏰ Timer reset for ${serviceName} in ${env} by ${userId}`);
        } else {
          // User no longer owns this service
          await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'Service already released',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:information_source: *\`${serviceName}\` in \`${env}\` is no longer claimed by you.*`
                }
              }
            ]
          });
        }
      }
    } catch (error) {
      console.error('Error handling reminder Still in Use button:', error);
    }
  });

  // Handle "Release" button from reminder DMs
  app.action('reminder_release', async ({ ack, body, client }) => {
    await ack();

    try {
      // Parse the button value to get context
      const { env, service: serviceName } = JSON.parse(body.actions[0].value);
      const userId = body.user.id;

      // Call the release function
      const result = await processRelease(environments, env, [serviceName], userId);

      if (result.released.length > 0) {
        // Successfully released
        const releasedService = result.released[0];

        // Update the DM message
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          text: 'Service released',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *Released \`${serviceName}\` in \`${env}\`*\n\nHeld for ${releasedService.duration}`
              }
            }
          ]
        });

        // Post to the notification channel
        if (NOTIFICATION_CHANNEL) {
          let message = `<@${userId}> released *${serviceName}* (${env}, held for ${releasedService.duration})`;

          // Check if someone auto-claimed from queue
          if (result.autoClaimed.length > 0) {
            const autoClaim = result.autoClaimed[0];
            message += `\n:arrow_forward: <@${autoClaim.nextUser}> automatically claimed *${serviceName}* (${env}) - ${autoClaim.task}`;
          }

          try {
            await client.chat.postMessage({
              channel: NOTIFICATION_CHANNEL,
              text: message
            });
          } catch (channelError) {
            console.error('Error posting to notification channel:', channelError);
            // Not a critical error - the service is still released
          }
        } else {
          console.warn('No NOTIFICATION_CHANNEL configured - skipping channel notification');
        }

        console.log(`✅ Released ${serviceName} in ${env} via reminder DM by ${userId}`);
      } else if (result.notOwned.length > 0) {
        // User doesn't own this service
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          text: 'Not your service',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:information_source: *You don't own \`${serviceName}\` in \`${env}\`*\n\nIt may have already been released or claimed by someone else.`
              }
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error handling reminder Release button:', error);

      // Try to update the message to show an error
      try {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          text: 'Error releasing service',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':x: *Error releasing service*\n\nPlease try releasing manually with `/claim drop`'
              }
            }
          ]
        });
      } catch (updateError) {
        console.error('Error updating error message:', updateError);
      }
    }
  });
};
