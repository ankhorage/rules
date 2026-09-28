import { writeJsonFileAtomic } from '@ankhorage/utility/node/fs';

import type { RulesConfig } from '../../../../types/rules.js';
import { compareRuleEntityIds } from '../../../../utils/compareRuleEntityIds.js';
import { validateRulesConfig } from '../../domain/validateRulesConfig.js';

/*** Validate and atomically write canonical rules.json configuration through the filesystem adapter. */
export async function writeRulesConfigAsync(path: string, config: RulesConfig): Promise<void> {
  const validation = validateRulesConfig(config);
  if (validation.config === null) {
    throw new Error(validation.diagnostics.map((diagnostic) => diagnostic.message).join('\n'));
  }

  await writeJsonFileAtomic(path, canonicalizeRulesConfig(validation.config));
}

/*** Canonicalize rule selection order so writing preserves deterministic configuration composition. */
function canonicalizeRulesConfig(config: RulesConfig): RulesConfig {
  return {
    version: 1,
    rules: [...config.rules].sort(compareRuleEntityIds),
  };
}
