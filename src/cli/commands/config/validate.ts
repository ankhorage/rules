import { validateRulesConfigFileAsync } from '../../../features/configuration/composition/validateRulesConfigFileAsync.js';

/*** Execute the public rules config validation command through the reusable configuration operation. */
export async function validate(
  argv: readonly string[],
  cwd: string,
): Promise<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}> {
  if (argv.length > 1) {
    return {
      exitCode: 1,
      stderr: 'ankh rules config validate accepts at most one rules.json path.\n',
      stdout: '',
    };
  }

  const result = await validateRulesConfigFileAsync(argv.at(0), cwd);
  if (result.diagnostics.length === 0) {
    return {
      exitCode: 0,
      stderr: '',
      stdout: `rules config validate\nvalid: ${result.path}\n`,
    };
  }

  return {
    exitCode: 1,
    stderr: '',
    stdout: [
      'rules config validate',
      `invalid: ${result.path}`,
      ...result.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
      '',
    ].join('\n'),
  };
}
