/**
 * DM Test Subcommand
 * Sends a test DM with interactive buttons to the user
 */

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
};
