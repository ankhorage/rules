import { areCapabilitiesEqual, isCapability } from '@ankhorage/contracts/capabilities';
import { expect, test } from 'bun:test';

import packageJson from '../../package.json' with { type: 'json' };
import { CAPABILITIES } from '../capabilities/index.js';
import { createRulesRuntimeProvider } from './createRulesRuntimeProvider.js';

test('publishes the canonical Rules capability without provider drift', () => {
  expect(CAPABILITIES).toHaveLength(1);
  expect(CAPABILITIES.every(isCapability)).toBeTrue();
  expect(CAPABILITIES[0]).toMatchObject({
    id: 'rules.config.validate',
    owner: '@ankhorage/rules',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
  });

  expect(packageJson.exports['./capabilities']).toEqual({
    types: './dist/capabilities/index.d.ts',
    import: './dist/capabilities/index.js',
  });

  const published = packageJson.ankh.capabilities.at(0);
  expect(isCapability(published)).toBeTrue();
  if (!isCapability(published)) return;
  expect(areCapabilitiesEqual(published, CAPABILITIES[0])).toBeTrue();

  const provider = createRulesRuntimeProvider();
  expect(provider.capabilities).toBe(CAPABILITIES);
  expect(new Set(provider.commands.map(({ capability }) => capability))).toEqual(
    new Set(CAPABILITIES.map(({ id }) => id)),
  );
});
