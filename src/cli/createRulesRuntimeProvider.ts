import type { AnkhRuntimeCommandProvider } from '@ankhorage/ankh';

import {
  RULES_CAPABILITIES,
  RULES_COMMAND_CATEGORY,
  RULES_PACKAGE_VERSION,
} from '../constants/rules.js';
import { validate } from './commands/config/validate.js';

/*** Create the Ankh provider that registers the generic Rules configuration command. */
export function createRulesRuntimeProvider(): AnkhRuntimeCommandProvider {
  return {
    id: '@ankhorage/rules',
    category: RULES_COMMAND_CATEGORY,
    version: RULES_PACKAGE_VERSION,
    capabilities: [...RULES_CAPABILITIES],
    commands: [
      {
        path: ['config', 'validate'],
        capability: RULES_CAPABILITIES[0],
        summary: 'Validate the generic JSON shape of a repository rules.json file.',
      },
    ],
    handlers: [
      {
        path: ['config', 'validate'],
        handler: async ({ argv, context }) => {
          const result = await validate(argv, context.cwd);
          context.writeStdout(result.stdout);
          return { exitCode: result.exitCode };
        },
      },
    ],
  };
}
