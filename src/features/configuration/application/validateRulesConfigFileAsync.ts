import type { RulesConfigDiagnostic, RulesConfigReadResult } from '../../../types/rules.js';
import { validateRulesConfig } from '../domain/validateRulesConfig.js';

/*** Read and validate one Rules configuration through a caller supplied source reader. */
export async function validateRulesConfigFileAsync(
  path: string,
  readSourceAsync: (path: string) => Promise<string>,
): Promise<RulesConfigReadResult> {
  try {
    const source = await readSourceAsync(path);
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

/*** Convert source and JSON failures into a portable configuration diagnostic. */
function createReadDiagnostic(error: unknown): RulesConfigDiagnostic {
  return {
    code: 'invalid-config',
    message: error instanceof Error ? error.message : 'Unable to read rules.json.',
  };
}
