import type { AnkhRuntimeCommandProvider } from '@ankhorage/ankh';

import {
  RULES_CAPABILITIES,
  RULES_COMMAND_CATEGORY,
  RULES_PACKAGE_VERSION,
} from '../packageMetadata.js';
import { validateRulesConfigFileAsync } from '../validateRulesConfigFileAsync.js';

/*** Create the Ankh provider that exposes the generic JSON config validation operation. */
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
          const result = await runConfigValidateCommand(argv, context.cwd);
          context.writeStdout(renderConfigValidation(result));
          return { exitCode: result.diagnostics.length === 0 ? 0 : 1 };
        },
      },
    ],
  };
}

/*** Validate an Ankh command invocation without creating a separate CLI implementation path. */
export async function runConfigValidateCommand(
  argv: readonly string[],
  cwd: string,
): Promise<Awaited<ReturnType<typeof validateRulesConfigFileAsync>>> {
  if (argv.length > 1)
    throw new Error('ankh rules config validate accepts at most one rules.json path.');
  return await validateRulesConfigFileAsync(argv.at(0), cwd);
}

/*** Render a compact, transport-neutral report for standalone and Ankh CLI callers. */
export function renderConfigValidation(
  result: Awaited<ReturnType<typeof validateRulesConfigFileAsync>>,
): string {
  if (result.diagnostics.length === 0) return `rules config validate\nvalid: ${result.path}\n`;
  return [
    'rules config validate',
    `invalid: ${result.path}`,
    ...result.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
    '',
  ].join('\n');
}

const provider = createRulesRuntimeProvider();

export default provider;
