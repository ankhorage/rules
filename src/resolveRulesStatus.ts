import type { RuleFinding, RulesStatusDescriptor } from './types/rules.js';

/*** Summarize generic rule findings using the reusable status semantics formerly owned by Policy. */
export function resolveRulesStatus(
  findings: readonly Pick<RuleFinding, 'severity'>[],
): RulesStatusDescriptor {
  if (findings.some((finding) => finding.severity === 'error')) {
    return { status: 'invalid', color: 'red' };
  }
  if (findings.some((finding) => finding.severity === 'warning')) {
    return { status: 'warnings', color: 'yellow' };
  }
  return { status: 'canonical', color: 'green' };
}
