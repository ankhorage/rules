import type { RuleEvaluationResult, RulesStatusDescriptor } from '../../../types/rules.js';

/*** Summarize a complete generic Rules evaluation without treating diagnostics as canonical success. */
export function resolveRulesStatus(
  result: Pick<RuleEvaluationResult, 'diagnostics' | 'findings'>,
): RulesStatusDescriptor {
  if (
    result.diagnostics.length > 0 ||
    result.findings.some((finding) => finding.severity === 'error')
  ) {
    return { status: 'invalid', color: 'red' };
  }
  if (result.findings.some((finding) => finding.severity === 'warning')) {
    return { status: 'warnings', color: 'yellow' };
  }
  return { status: 'canonical', color: 'green' };
}
