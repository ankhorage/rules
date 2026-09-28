import { resolve } from 'node:path';

import { readRulesConfigAsync } from '../adapters/filesystem/readRulesConfigAsync.js';
import type { RulesConfigReadResult } from '../../../types/rules.js';

/*** Validate one explicit or default rules.json path through the public configuration operation. */
export async function validateRulesConfigFileAsync(
  inputPath: string | undefined,
  cwd: string,
): Promise<RulesConfigReadResult> {
  return await readRulesConfigAsync(resolve(cwd, inputPath ?? 'rules.json'));
}
