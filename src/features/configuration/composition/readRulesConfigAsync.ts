import type { RulesConfigReadResult } from '../../../types/rules.js';
import { readRulesConfigSourceAsync } from '../adapters/filesystem/readRulesConfigSourceAsync.js';
import { validateRulesConfigFileAsync } from '../application/validateRulesConfigFileAsync.js';

/*** Wire the configuration source reader into the public file-validation operation. */
export async function readRulesConfigAsync(path: string): Promise<RulesConfigReadResult> {
  return await validateRulesConfigFileAsync(path, readRulesConfigSourceAsync);
}
