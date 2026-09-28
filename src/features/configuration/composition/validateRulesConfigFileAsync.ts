import { resolve } from 'node:path';

import type { RulesConfigReadResult } from '../../../types/rules.js';
import { readRulesConfigAsync } from '../adapters/filesystem/readRulesConfigAsync.js';

/*** Resolve and validate one explicit or default rules.json file through the filesystem adapter. */
export async function validateRulesConfigFileAsync(
  inputPath: string | undefined,
  cwd: string,
): Promise<RulesConfigReadResult> {
  return await readRulesConfigAsync(resolve(cwd, inputPath ?? 'rules.json'));
}
