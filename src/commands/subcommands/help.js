const { SERVICES, ENVIRONMENT_NAMES } = require('../../config');

module.exports = async function({ respond }, environments, args) {
  const envList = ENVIRONMENT_NAMES.join(', ');
  const serviceList = SERVICES.join(', ');

  const helpText = `
*Environment Manager - /claim Command*

*Environments:* ${envList}
*Services:* ${serviceList}

━━━ *CLAIMING SERVICES* ━━━
\`/claim\` - Interactive modal with environment + service selection
\`/claim <env>\` - Interactive modal for specific environment
\`/claim <env> <service1,service2> <task>\` - Direct claim (supports multiple services)

━━━ *RELEASING SERVICES* ━━━
\`/claim drop\` - Interactive modal to release services
\`/claim drop <env>\` - Interactive modal for specific environment
\`/claim drop <env> <service1,service2>\` - Release specific services

━━━ *QUEUE MANAGEMENT* ━━━
\`/claim queue <env> <service> <task>\` - Join queue for busy service
\`/claim dequeue\` - Interactive modal to leave queues
\`/claim dequeue <env> <service1,service2>\` - Remove yourself from specific queues
\`/claim prioritize\` - Interactive modal for urgent takeover
\`/claim prioritize <env>\` - Interactive modal for specific environment
\`/claim prioritize <env> <service1,service2> <task>\` - Urgent takeover (direct)

━━━ *VIEWING STATUS* ━━━
\`/claim status\` - View all in-use services across environments

━━━ *ADMIN COMMANDS* ━━━
\`/claim force-drop <env> <service1,service2>\` - Override any claim

━━━ *TIPS* ━━━
• Use commas to work with multiple services at once
• Environment shortcuts: Use first letter (e.g., \`s\` for staging)
• Interactive modals are the easiest way to get started!
  `.trim();

  await respond({
    text: helpText,
    response_type: 'ephemeral'
  });
};
