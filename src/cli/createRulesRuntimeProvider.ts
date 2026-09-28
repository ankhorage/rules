import type { AnkhRuntimeCommandProvider } from '@ankhorage/ankh';

import packageJson from '../../package.json';
import { validate } from './commands/config/validate.js';

/*** Create the Ankh provider exposing the canonical generic Rules configuration command. */
export function createRulesRuntimeProvider() {
  return {
    id: '@ankhorage/rules',
    category: 'rules',
    version: packageJson.version,
    capabilities: ['rules.config.validate'],
    commands: [
      {
        path: ['config', 'validate'],
        capability: 'rules.config.validate',
        summary: 'Validate the generic JSON shape of a repository rules.json file.',
      },
    ],
    handlers: [
      {
        path: ['config', 'validate'],
        handler: async ({ argv, context }) => {
          const result = await validate(argv, context.cwd);
          if (result.stdout.length > 0) context.writeStdout(result.stdout);
          if (result.stderr.length > 0) context.writeStderr(result.stderr);
          return { exitCode: result.exitCode };
        },
      },
    ],
  } satisfies AnkhRuntimeCommandProvider;
}
