#!/usr/bin/env bun

import { validate } from './commands/config/validate.js';

/*** Run the standalone Rules CLI without depending on the Ankh runtime package. */
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

  try {
    const result = await validate(restTokens.slice(1), process.cwd());
    process.stdout.write(result.stdout);
    return { exitCode: result.exitCode };
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Rules command failed.'}\n`);
    return { exitCode: 1 };
  }
}

/*** Identify help tokens accepted by the standalone delivery adapter. */
function isHelpToken(value: string): boolean {
  return value === '--help' || value === '-h' || value === 'help';
}

/*** Render standalone help without introducing a second command implementation. */
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
