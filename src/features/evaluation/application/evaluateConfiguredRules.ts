import { validateRulesConfig } from '../../configuration/domain/validateRulesConfig.js';
import type {
  EvaluateConfiguredRulesOptions,
  RuleEvaluationDiagnostic,
  RuleEvaluationResult,
  RuleFinding,
  RuleRegistry,
  RulesConfig,
  RulesConfigDiagnostic,
} from '../../../types/rules.js';
import { evaluateRules } from '../domain/evaluateRules.js';

/*** Resolve a configured Rule registry and evaluate its enabled rules without provider branches. */
export function evaluateConfiguredRules<TContext>(
  context: TContext,
  config: RulesConfig,
  registry: RuleRegistry<TContext>,
  options: EvaluateConfiguredRulesOptions = {},
): RuleEvaluationResult {
  const validation = validateRulesConfig(config, {
    registry,
    capabilities: options.capabilities,
  });
  if (validation.config === null) {
    return {
      findings: [],
      diagnostics: validation.diagnostics.map(toEvaluationDiagnostic),
    };
  }

  const enabledConfigurations = validation.config.rules.filter((rule) => rule.enabled);
  const optionsByRuleId = new Map(
    enabledConfigurations.map((rule) => [rule.id, rule.options] as const),
  );
  const selectedRules = enabledConfigurations.flatMap((configuredRule) => {
    const rule = registry.ruleById.get(configuredRule.id);
    return rule === undefined ? [] : [rule];
  });
  const result = evaluateRules(context, selectedRules, {
    capabilities: options.capabilities,
    optionsByRuleId,
  });

  return {
    diagnostics: result.diagnostics,
    findings: applyConfiguredSeverities(result.findings, validation.config),
  };
}

/*** Translate config validation failures without collapsing their machine-readable diagnostic codes. */
function toEvaluationDiagnostic(diagnostic: RulesConfigDiagnostic): RuleEvaluationDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.ruleId === undefined ? {} : { ruleId: diagnostic.ruleId }),
  };
}

/*** Apply configured severity overrides after providers have produced neutral findings. */
function applyConfiguredSeverities(
  findings: readonly RuleFinding[],
  config: RulesConfig,
): readonly RuleFinding[] {
  const severityByRuleId = new Map(config.rules.map((rule) => [rule.id, rule.severity] as const));
  return findings.map((finding) => ({
    ...finding,
    severity: severityByRuleId.get(finding.ruleId) ?? finding.severity,
  }));
}
