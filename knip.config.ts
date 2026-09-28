import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  entry: [
    'src/index.ts',
    'src/cli/index.ts',
    'src/cli/standalone.ts',
    'examples/**/*.ts',
    'paradox.config.ts',
    'eslint.examples.config.mjs',
  ],
  ignoreFiles: ['.prettierrc.js', 'eslint.config.mjs', 'prettier.local.config.js'],
});
