import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/*** Verify the packed package works from a fresh consumer without repository dev dependencies. */
async function verifyPackedPackageAsync(): Promise<void> {
  const repositoryRoot = resolve(import.meta.dir, '..');
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'ankhorage-rules-packed-'));
  const packDirectory = join(temporaryRoot, 'pack');
  const consumerDirectory = join(temporaryRoot, 'consumer');

  try {
    await mkdir(packDirectory);
    await mkdir(consumerDirectory);
    run(['npm', 'pack', '--ignore-scripts', '--pack-destination', packDirectory], repositoryRoot);

    const artifacts = (await readdir(packDirectory)).filter((name) => name.endsWith('.tgz'));
    if (artifacts.length !== 1) {
      throw new Error(`Expected one packed artifact, found ${artifacts.length}.`);
    }

    const artifact = join(packDirectory, artifacts[0] as string);
    await writeFile(
      join(consumerDirectory, 'package.json'),
      JSON.stringify({ name: 'rules-standalone-consumer', private: true, version: '0.0.0' }),
    );
    run(['bun', 'add', artifact, '--ignore-scripts'], consumerDirectory);
    run(
      [
        'bun',
        '-e',
        [
          "const rules = await import('@ankhorage/rules');",
          "if (typeof rules.validateRulesConfig !== 'function') throw new Error('missing root API');",
          "if ('runCli' in rules || 'createRulesRuntimeProvider' in rules) throw new Error('CLI leaked into root API');",
          "const cli = await import('@ankhorage/rules/cli');",
          "if (cli.createRulesRuntimeProvider().capabilities.at(0) !== 'rules.config.validate') throw new Error('missing CLI capability');",
        ].join(' '),
      ],
      consumerDirectory,
    );

    const binary = join(consumerDirectory, 'node_modules', '.bin', 'ankhorage-rules');
    const help = run([binary, '--help'], consumerDirectory);
    if (!help.includes('ankhorage-rules config validate')) {
      throw new Error('Installed Rules binary did not expose canonical help.');
    }
    await writeFile(join(consumerDirectory, 'rules.json'), '{"version":1,"rules":[]}\n');
    const validation = run([binary, 'config', 'validate'], consumerDirectory);
    if (!validation.includes('valid:')) {
      throw new Error('Installed Rules binary did not validate rules.json.');
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

/*** Run one subprocess and return stdout or fail with its captured stderr. */
function run(command: readonly string[], cwd: string): string {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const stdout = result.stdout.toString();
  if (result.exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed:\n${result.stderr.toString()}\n${stdout}`);
  }
  return stdout;
}

await verifyPackedPackageAsync();
