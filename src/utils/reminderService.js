/**
 * Reminder Service
 * Background service that sends DM reminders to users who have held services for over 2 hours
 */

// Configuration (in milliseconds)
const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

// For testing, you can temporarily set these to shorter intervals:
// const TWO_HOURS = 1 * 60 * 1000; // 1 minute for testing
// const CHECK_INTERVAL = 30 * 1000; // 30 seconds for testing

/**
 * Check if current time is within reminder hours (4pm-11pm UTC)
 */
function isWithinReminderHours() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return utcHour >= 16 && utcHour <= 23; // 4pm (16:00) to 11pm (23:00) UTC inclusive
}

/**
 * Format duration for logging
 */
function formatDuration(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

/**
 * Send a reminder DM to a user
 */
async function sendReminder(client, service, envName, serviceName) {
  try {
    // Open DM conversation
    const dmChannel = await client.conversations.open({
      users: service.owner
    });

    const duration = Date.now() - service.startTime;
    const durationFormatted = formatDuration(duration);

    // Send message with interactive buttons
    await client.chat.postMessage({
      channel: dmChannel.channel.id,
      text: `You've been using ${serviceName} in ${envName} for over 2 hours`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: *You've been using \`${serviceName}\` in \`${envName}\` for ${durationFormatted}*\n\nAre you still using it, or can it be released for others?`
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
              action_id: 'reminder_still_in_use',
              value: JSON.stringify({
                env: envName,
                service: serviceName
              })
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Release'
              },
              style: 'danger',
              action_id: 'reminder_release',
              value: JSON.stringify({
                env: envName,
                service: serviceName
              })
            }
          ]
        }
      ]
    });

    console.log(`📨 Sent reminder to ${service.owner} for ${serviceName} in ${envName} (held for ${durationFormatted})`);
    return true;
  } catch (error) {
    console.error(`Error sending reminder for ${serviceName} in ${envName}:`, error);
    return false;
  }
}

/**
 * Check all services and send reminders where needed
 */
async function checkAndSendReminders(app, environments) {
  // Check if we're within reminder hours
  if (!isWithinReminderHours()) {
    const now = new Date();
    console.log(`⏰ Outside reminder hours (current UTC hour: ${now.getUTCHours()}). Skipping check.`);
    return;
  }

  console.log('🔍 Checking for services that need reminders...');

  const now = Date.now();
  let remindersSent = 0;

  // Loop through all environments and services
  for (const [envName, env] of Object.entries(environments)) {
    for (const [serviceName, service] of Object.entries(env.services)) {
      // Skip if service is not claimed
      if (!service.owner || !service.startTime) {
        continue;
      }

      // Calculate how long the service has been held
      const duration = now - service.startTime;

      // Calculate time since last reminder (if any)
      const timeSinceLastReminder = service.lastReminderSent
        ? now - service.lastReminderSent
        : Infinity;

      // Send reminder if:
      // 1. Service has been held for over 2 hours
      // 2. No reminder sent yet OR last reminder was over 2 hours ago
      // 3. There is a queue for this service
      if (duration > TWO_HOURS && timeSinceLastReminder > TWO_HOURS && service.queue && service.queue.length > 0) {
        const success = await sendReminder(app.client, service, envName, serviceName);

        if (success) {
          // Track that we sent a reminder
          service.lastReminderSent = now;
          remindersSent++;
        }
      }
    }
  }

  if (remindersSent > 0) {
    console.log(`✅ Sent ${remindersSent} reminder(s)`);
  } else {
    console.log('✅ No reminders needed at this time');
  }
}

/**
 * Start the reminder service
 */
function start(app, environments) {
  console.log('🚀 Starting reminder service...');
  console.log(`   - Reminder threshold: ${formatDuration(TWO_HOURS)}`);
  console.log(`   - Check interval: ${formatDuration(CHECK_INTERVAL)}`);
  console.log(`   - Active hours: 4pm-11pm UTC`);

  // Run initial check after 1 minute (give the app time to fully start)
  setTimeout(() => {
    checkAndSendReminders(app, environments).catch(err => {
      console.error('Error in initial reminder check:', err);
    });
  }, 60 * 1000);

  // Set up recurring checks
  setInterval(() => {
    checkAndSendReminders(app, environments).catch(err => {
      console.error('Error in reminder check:', err);
    });
  }, CHECK_INTERVAL);

  console.log('✅ Reminder service started');
}

module.exports = {
  start
};
