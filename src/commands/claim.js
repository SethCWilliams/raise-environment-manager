const { normalizeEnvironment, isValidEnvironment, isChannelAllowed } = require('../utils/helpers');
const claimModal = require('./modals/claimModal');
const dropModal = require('./modals/dropModal');
const dequeueModal = require('./modals/dequeueModal');
const prioritizeModal = require('./modals/prioritizeModal');

// Import subcommand handlers
const SUBCOMMANDS = {
  'status': require('./subcommands/status'),
  'drop': require('./subcommands/drop'),
  'queue': require('./subcommands/queue'),
  'dequeue': require('./subcommands/dequeue'),
  'prioritize': require('./subcommands/prioritize'),
  'force-drop': require('./subcommands/forceDrop'),
  'help': require('./subcommands/help')
};

module.exports = function(app, environments) {
  app.command('/claim', async ({ command, ack, say, respond, client }) => {
    await ack();

    // Check if channel is whitelisted
    if (!isChannelAllowed(command.channel_id)) {
      await respond({
        text: 'This bot can only be used in authorized channels.',
        response_type: 'ephemeral'
      });
      return;
    }

    const args = command.text.trim().split(/\s+/);

    // Case 1: No args → show modal with env dropdown
    if (args.length === 0 || !args[0]) {
      try {
        await claimModal.showModal({ client, command });
      } catch (error) {
        console.error('Error opening claim modal:', error);
        await respond({
          text: 'Failed to open interactive dialog. Please try again.',
          response_type: 'ephemeral'
        });
      }
      return;
    }

    const firstArg = args[0].toLowerCase();

    // Case 2: First arg is a known subcommand → route to handler
    if (SUBCOMMANDS[firstArg]) {
      const context = { command, ack, say, respond, client };
      const remainingArgs = args.slice(1);
      await SUBCOMMANDS[firstArg](context, environments, remainingArgs);
      return;
    }

    // Case 3: First arg is environment → direct claim flow
    const env = normalizeEnvironment(firstArg);
    if (isValidEnvironment(env)) {
      // If only env provided, show modal
      if (args.length === 1) {
        try {
          await claimModal.showModalWithEnv({ client, command, env });
        } catch (error) {
          console.error('Error opening claim modal with env:', error);
          await respond({
            text: 'Failed to open interactive dialog. Please try again.',
            response_type: 'ephemeral'
          });
        }
        return;
      }

      // Otherwise, direct claim
      const claimDirect = require('./subcommands/claimDirect');
      const context = { command, ack, say, respond, client };
      await claimDirect(context, environments, { env, args: args.slice(1) });
      return;
    }

    // Case 4: Unknown first arg → show error and suggest help
    await respond({
      text: `Unknown command or environment: "${args[0]}"\n\nType \`/claim help\` to see all available subcommands.`,
      response_type: 'ephemeral'
    });
  });

  // Register modal handlers
  claimModal.registerHandlers(app, environments);
  dropModal.registerHandlers(app, environments);
  dequeueModal.registerHandlers(app, environments);
  prioritizeModal.registerHandlers(app, environments);
};
