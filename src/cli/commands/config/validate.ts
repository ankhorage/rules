import { resolve } from 'node:path';

import { readRulesConfigAsync } from '../../../features/configuration/adapters/filesystem/readRulesConfigAsync.js';

/*** Execute the public `ankh rules config validate` command through the configuration feature. */
export async function validate(
  argv: readonly string[],
  cwd: string,
): Promise<{ readonly exitCode: number; readonly stdout: string }> {
  if (argv.length > 1) {
    throw new Error('ankh rules config validate accepts at most one rules.json path.');
  }

  const result = await readRulesConfigAsync(resolve(cwd, argv.at(0) ?? 'rules.json'));
  return {
    exitCode: result.diagnostics.length === 0 ? 0 : 1,
    stdout: renderConfigValidation(result),
  };
}

/*** Render the command result without coupling the configuration feature to a transport. */
function renderConfigValidation(result: Awaited<ReturnType<typeof readRulesConfigAsync>>): string {
  if (result.diagnostics.length === 0) return `rules config validate\nvalid: ${result.path}\n`;
  return [
    'rules config validate',
    `invalid: ${result.path}`,
    ...result.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
    '',
  ].join('\n');
}
