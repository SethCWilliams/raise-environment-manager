const { SERVICES, ENVIRONMENT_NAMES } = require('../../config');

module.exports = async function ({ respond }, environments, args) {
  const envList = ENVIRONMENT_NAMES.join(', ');
  const serviceList = SERVICES.join(', ');

  const helpText = `
*🎯 Environment Manager - Quick Reference*

*Environments:* ${envList}
*Services:* ${serviceList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 INTERACTIVE MODALS* (Easiest - Just Fill the Form!)

\`/claim\` - Claim services
\`/claim drop\` - Release services
\`/claim queue\` - Join queue for busy services
\`/claim dequeue\` - Leave queues you're in
\`/claim prioritize\` - Urgent takeover (use sparingly!)

💡 _Tip: Add environment after command (e.g., \`/claim s\`) to skip env selection_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*⚡ DIRECT COMMANDS* (Power Users - Faster!)

Pattern: \`/claim <subcommand> <env> <service1,service2> <task>\`

Examples:
  \`/claim s api,worker Deploying v2.0\`
  \`/claim drop s api,worker\`
  \`/claim queue s api Bug fixes\`
  \`/claim dequeue s api,worker\`
  \`/claim prioritize s api Hotfix\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📊 OTHER COMMANDS*

\`/claim status\` - View all in-use services
\`/claim force-drop <env> <services>\` - Force drop of specific services

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*✨ SHORTCUTS & TIPS*

• Environment shortcuts: \`s\` = staging, \`d\` = dev
• Multiple services: Use commas (\`api,worker,frontend\`)
• Auto-claim: When queued, you'll claim automatically when released
• Priority mode: Immediately takes over, moves current owner to queue position 1
  `.trim();

  await respond({
    text: helpText,
    response_type: 'ephemeral'
  });
};
