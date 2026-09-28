/*** Verify the built package artifact exposes its public Rules and CLI provider contracts. */
import { createRulesRuntimeProvider, validateRulesConfig } from '../dist/index.js';

const provider = createRulesRuntimeProvider();
const validation = validateRulesConfig({ version: 1, rules: [] });

if (provider.capabilities.at(0) !== 'rules.config.validate') {
  throw new Error('Built package provider does not expose rules.config.validate.');
}

if (validation.config === null) {
  throw new Error('Built package cannot validate an empty canonical Rules configuration.');
}
