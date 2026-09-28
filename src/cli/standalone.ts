#!/usr/bin/env bun

import { createDefaultCommandContext } from '@ankhorage/ankh';

import { renderConfigValidation, runConfigValidateCommand } from './index.js';

/*** Run the standalone Rules config validator through the same public operation as the Ankh provider. */
export async function runCli(argv: readonly string[]): Promise<{ readonly exitCode: number }> {
  const context = createDefaultCommandContext();
  const [firstToken, ...restTokens] = argv;
  if (firstToken === undefined || isHelpToken(firstToken)) {
    context.writeStdout(renderHelp());
    return { exitCode: 0 };
  }
  if (firstToken !== 'config' || restTokens.at(0) !== 'validate') {
    context.writeStderr('Unknown Rules command. Run ankhorage-rules --help.\n');
    return { exitCode: 1 };
  }

  try {
    const result = await runConfigValidateCommand(restTokens.slice(1), context.cwd);
    context.writeStdout(renderConfigValidation(result));
    return { exitCode: result.diagnostics.length === 0 ? 0 : 1 };
  } catch (error) {
    context.writeStderr(`${error instanceof Error ? error.message : 'Rules command failed.'}\n`);
    return { exitCode: 1 };
  }
}

/*** Identify help tokens accepted by the small standalone command adapter. */
function isHelpToken(value: string): boolean {
  return value === '--help' || value === '-h' || value === 'help';
}

/*** Render the standalone command contract without implying provider discovery. */
function renderHelp(): string {
  return [
    '@ankhorage/rules',
    '',
    'Usage:',
    '  ankhorage-rules config validate [rules.json]',
    '  ankh rules config validate [rules.json]',
    '',
  ].join('\n');
}

if (import.meta.main) {
  const result = await runCli(process.argv.slice(2));
  process.exit(result.exitCode);
}
