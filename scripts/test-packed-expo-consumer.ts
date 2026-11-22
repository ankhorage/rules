import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/*** Verify the packed portable Rules entrypoint bundles in every Expo SDK 57 Metro target. */
async function verifyPackedExpoConsumerAsync(): Promise<void> {
  const repositoryRoot = resolve(import.meta.dir, '..');
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'ankhorage-rules-expo-'));
  const packDirectory = join(temporaryRoot, 'pack');
  const consumerDirectory = join(temporaryRoot, 'consumer');

  try {
    await mkdir(packDirectory);
    await mkdir(consumerDirectory);
    run(['bun', 'run', 'build'], repositoryRoot);
    run(['bun', 'pm', 'pack', '--destination', packDirectory], repositoryRoot);

    const artifact = join(packDirectory, await packedTarball(packDirectory));
    await Bun.write(join(consumerDirectory, 'package.json'), consumerManifest(artifact));
    await Bun.write(join(consumerDirectory, 'App.js'), consumerApp());
    run(
      ['npm', '--cache', join(temporaryRoot, 'npm-cache'), 'install', '--ignore-scripts'],
      consumerDirectory,
    );

    for (const platform of ['web', 'android', 'ios'] as const) {
      run(
        [
          join(consumerDirectory, 'node_modules', '.bin', 'expo'),
          'export',
          '--platform',
          platform,
          '--output-dir',
          join(consumerDirectory, 'dist', platform),
        ],
        consumerDirectory,
      );
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

/*** Produce the isolated SDK 57 consumer manifest without borrowing repository dependencies. */
function consumerManifest(artifact: string): string {
  return JSON.stringify({
    name: 'ankhorage-rules-expo-consumer',
    private: true,
    version: '0.0.0',
    main: 'App.js',
    dependencies: {
      '@ankhorage/rules': `file:${artifact}`,
      expo: '57.0.33',
      react: '19.2.0',
      'react-dom': '19.2.0',
      'react-native': '0.83.2',
      'react-native-web': '0.21.2',
    },
  });
}

/*** Exercise the portable evaluator from the consumer's application entrypoint. */
function consumerApp(): string {
  return [
    "import { evaluateRules } from '@ankhorage/rules';",
    '',
    "const rule = { identity: { id: 'fixture.rule', version: '1.0.0' }, summary: 'fixture', defaultSeverity: 'info', dependencies: [], evaluate: () => ({ status: 'PASS', findings: [] }) };",
    "void evaluateRules({}, [rule], { scope: { id: 'fixture', kind: 'fixture' } });",
    '',
    'export default function App() {',
    '  return null;',
    '}',
    '',
  ].join('\n');
}

/*** Locate the only candidate artifact without coupling the check to a package version. */
async function packedTarball(directory: string): Promise<string> {
  const tarballs = (await readdir(directory)).filter((file) => file.endsWith('.tgz'));
  const [tarball] = tarballs;
  if (tarball === undefined || tarballs.length !== 1) {
    throw new Error(`Expected one packed tarball, received ${tarballs.length}.`);
  }
  return tarball;
}

/*** Run one consumer-boundary command and preserve its diagnostic output on failure. */
function run(command: readonly string[], cwd: string): void {
  const result = Bun.spawnSync(command, { cwd, stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(' ')}`);
  }
}

await verifyPackedExpoConsumerAsync();
