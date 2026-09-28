import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',
  docs: {
    title: '@ankhorage/rules',
    description: 'Domain-agnostic rule engine and JSON configuration for Ankhorage.',
  },
  package: {
    root: '.',
    entrypoints: ['src/index.ts'],
  },
  output: { dir: './paradox' },
});
