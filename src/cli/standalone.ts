#!/usr/bin/env bun

import { validate } from './commands/config/validate.js';

/*** Run the standalone Rules CLI through the same command adapter used by the Ankh provider. */
export async function runCli(argv: readonly string[]): Promise<{ readonly exitCode: number }> {
  const [firstToken, ...restTokens] = argv;
  if (firstToken === undefined || isHelpToken(firstToken)) {
    process.stdout.write(renderHelp());
    return { exitCode: 0 };
  }
  if (firstToken !== 'config' || restTokens.at(0) !== 'validate') {
    process.stderr.write('Unknown Rules command. Run ankhorage-rules --help.\n');
    return { exitCode: 1 };
  }

  const result = await validate(restTokens.slice(1), process.cwd());
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  return { exitCode: result.exitCode };
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
