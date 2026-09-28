import { readFile } from 'node:fs/promises';

import type { RulesConfigDiagnostic, RulesConfigReadResult } from './types/rules.js';
import { validateRulesConfig } from './validateRulesConfig.js';

/*** Read and structurally validate a repository rules.json file. */
export async function readRulesConfigAsync(path: string): Promise<RulesConfigReadResult> {
  try {
    const source = await readFile(path, 'utf8');
    return { path, ...validateRulesConfig(parseJson(source)) };
  } catch (error) {
    return {
      path,
      config: null,
      diagnostics: [createReadDiagnostic(error)],
    };
  }
}

/*** Parse JSON without conflating a syntax failure with a valid null configuration. */
function parseJson(source: string): unknown {
  return JSON.parse(source) as unknown;
}

/*** Convert filesystem and JSON failures into a portable configuration diagnostic. */
function createReadDiagnostic(error: unknown): RulesConfigDiagnostic {
  return {
    code: 'invalid-config',
    message: error instanceof Error ? error.message : 'Unable to read rules.json.',
  };
}
