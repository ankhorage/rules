import type { RulePolicyReport } from '../../types/rules.js';

/*** Render a completed portable policy report for a CI host and return its matching process status. */
export function gate(report: RulePolicyReport): {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
} {
  return {
    exitCode: report.decision === 'PASS' ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}
