import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import packageJson from '../../package.json' with { type: 'json' };
import { readRulesConfigAsync, writeRulesConfigAsync } from './index.js';

test('publishes filesystem configuration I/O only from the explicit Node entrypoint', async () => {
  expect(packageJson.exports['./node']).toEqual({
    types: './dist/node/index.d.ts',
    import: './dist/node/index.js',
  });

  const directory = await mkdtemp(join(tmpdir(), 'ankhorage-rules-'));
  const path = join(directory, 'rules.json');
  const config = {
    version: 1,
    rules: [
      { id: 'release.no-blockers', enabled: false },
      { id: 'content.minimum-words', enabled: true, options: { minimum: 2 } },
    ],
  } as const;

  try {
    await writeRulesConfigAsync(path, config);
    expect((await readRulesConfigAsync(path)).config?.rules.map((rule) => rule.id)).toEqual([
      'content.minimum-words',
      'release.no-blockers',
    ]);
    expect((await readRulesConfigAsync(path)).diagnostics).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
