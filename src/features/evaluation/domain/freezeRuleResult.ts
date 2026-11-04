import type {
  JsonValue,
  RuleFinding,
  RuleResult,
  RuleResultDiagnostic,
} from '../../../types/rules.js';

/*** Snapshot a result into an immutable JSON-only value before dependent providers receive it. */
export function freezeRuleResult(result: RuleResult): RuleResult {
  return Object.freeze({
    ...result,
    diagnostics: Object.freeze(result.diagnostics.map(copyDiagnostic)),
    findings: Object.freeze(result.findings.map(copyFinding)),
    rule: Object.freeze({ ...result.rule }),
    scope: Object.freeze({ ...result.scope }),
  });
}

/*** Copy a diagnostic so providers cannot retain a mutable reference to evaluator state. */
function copyDiagnostic(diagnostic: RuleResultDiagnostic): RuleResultDiagnostic {
  return Object.freeze({ ...diagnostic });
}

/*** Snapshot every nested provider finding value before sharing it with dependent providers. */
function copyFinding(finding: RuleFinding): RuleFinding {
  return Object.freeze({
    ...finding,
    evidence: copyJsonValue(finding.evidence),
    sourceLocation:
      finding.sourceLocation === undefined
        ? undefined
        : Object.freeze({ ...finding.sourceLocation }),
    subjects: Object.freeze(finding.subjects.map((subject) => Object.freeze({ ...subject }))),
  });
}

/*** Copy and deeply freeze the JSON-only evidence contract at the dependency boundary. */
function copyJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return Object.freeze(value.map(copyJsonValue));
  if (value !== null && typeof value === 'object') {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyJsonValue(entry)])),
    );
  }
  return value;
}
