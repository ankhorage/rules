# Public API

## createRuleEvaluationCacheKey

Kind: `function`
Module: `src/features/evaluation/domain/createRuleEvaluationCacheKey.ts`
Source: `src/features/evaluation/domain/createRuleEvaluationCacheKey.ts:10:1`

Build the complete cache identity only when callers provide both fact and authenticated partition versions.

### Signatures

- `(node: RuleEvaluationPlanNode, dependencyResults: readonly RuleResult[], options: Pick<EvaluateRulesOptions, "cachePartition" | "capabilities" | "factsVersion" | "optionsByRuleId">) => RuleEvaluationCacheKey | null`
  - dependencyResults: `readonly RuleResult[]`
  - node: `RuleEvaluationPlanNode`
  - options: `Pick<EvaluateRulesOptions, "cachePartition" | "capabilities" | "factsVersion" | "optionsByRuleId">`
  - returns: `RuleEvaluationCacheKey | null`

## createRuleEvaluationPlan

Kind: `function`
Module: `src/features/evaluation/domain/createRuleEvaluationPlan.ts`
Source: `src/features/evaluation/domain/createRuleEvaluationPlan.ts:15:1`

Project selected Rules and their complete dependency closure into a deterministic serializable graph.

### Signatures

- `(rules: readonly Rule<TContext, import("../../../index.js").JsonValue, import("../../../index.js").JsonValue>[], options?: Pick<EvaluateRulesOptions, "scope" | "selection">) => RuleEvaluationPlan`
  - options: `Pick<EvaluateRulesOptions, "scope" | "selection">` (optional)
  - rules: `readonly Rule<TContext, import("../../../index.js").JsonValue, import("../../../index.js").JsonValue>[]`
  - returns: `RuleEvaluationPlan`

## createRuleRegistry

Kind: `function`
Module: `src/features/evaluation/domain/createRuleRegistry.ts`
Source: `src/features/evaluation/domain/createRuleRegistry.ts:5:1`

Create a deterministic registry from independently owned RuleSets.

### Signatures

- `(ruleSets: readonly RuleSet<TContext>[]) => RuleRegistry<TContext>`
  - ruleSets: `readonly RuleSet<TContext>[]`
  - returns: `RuleRegistry<TContext>`

## evaluateConfiguredRules

Kind: `function`
Module: `src/features/evaluation/domain/evaluateConfiguredRules.ts`
Source: `src/features/evaluation/domain/evaluateConfiguredRules.ts:14:1`

Resolve a configured Rule registry and evaluate its enabled rules without provider branches.

### Signatures

- `(context: TContext, config: RulesConfig, registry: RuleRegistry<TContext>, options?: EvaluateConfiguredRulesOptions) => RuleEvaluationResult`
  - config: `RulesConfig`
  - context: `TContext`
  - options: `EvaluateConfiguredRulesOptions` (optional)
  - registry: `RuleRegistry<TContext>`
  - returns: `RuleEvaluationResult`

## EvaluateConfiguredRulesOptions

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:346:1`

Configured evaluator inputs that preserve caller capabilities and cache provenance.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| cache | property | `RuleEvaluationCache \| undefined` | no |  |
| cachePartition | property | `RuleEvaluationCachePartition \| undefined` | no |  |
| capabilities | property | `readonly string[] \| undefined` | no |  |
| factsVersion | property | `string \| undefined` | no |  |
| scope | property | `RuleScope \| undefined` | no |  |

## evaluateRulePolicy

Kind: `function`
Module: `src/features/evaluation/domain/evaluateRulePolicy.ts`
Source: `src/features/evaluation/domain/evaluateRulePolicy.ts:14:1`

Apply central Required and advisory profiles to a completed deterministic Rules evaluation.

### Signatures

- `(options: EvaluateRulePolicyOptions) => RulePolicyReport`
  - options: `EvaluateRulePolicyOptions`
  - returns: `RulePolicyReport`

## EvaluateRulePolicyOptions

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:274:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| evaluation | property | `RuleEvaluationResult` | yes |  |
| policy | property | `RulePolicy` | yes |  |
| provenance | property | `RulePolicyProvenance` | yes |  |

## evaluateRules

Kind: `function`
Module: `src/features/evaluation/domain/evaluateRules.ts`
Source: `src/features/evaluation/domain/evaluateRules.ts:20:1`

Evaluate a deterministic dependency plan once, passing completed child results to each provider.

### Signatures

- `(context: TContext, rules: readonly Rule<TContext, JsonValue, JsonValue>[], options?: EvaluateRulesOptions) => RuleEvaluationResult`
  - context: `TContext`
  - options: `EvaluateRulesOptions` (optional)
  - rules: `readonly Rule<TContext, JsonValue, JsonValue>[]`
  - returns: `RuleEvaluationResult`

## EvaluateRulesOptions

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:334:1`

Direct evaluator inputs that are independent of any repository configuration format.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| cache | property | `RuleEvaluationCache \| undefined` | no |  |
| cachePartition | property | `RuleEvaluationCachePartition \| undefined` | no |  |
| capabilities | property | `readonly string[] \| undefined` | no |  |
| disabledRuleIds | property | `readonly string[] \| undefined` | no |  |
| factsVersion | property | `string \| undefined` | no |  |
| optionsByRuleId | property | `ReadonlyMap<string, JsonValue \| undefined> \| undefined` | no |  |
| scope | property | `RuleScope \| undefined` | no |  |
| selection | property | `RuleSelection \| undefined` | no |  |

## getRuleExecutionProvenance

Kind: `function`
Module: `src/features/evaluation/domain/getRuleExecutionProvenance.ts`
Source: `src/features/evaluation/domain/getRuleExecutionProvenance.ts:4:1`

Resolve absent legacy provenance truthfully instead of inferring cache reuse from result equality.

### Signatures

- `(result: RuleResult) => RuleExecutionProvenance`
  - result: `RuleResult`
  - returns: `RuleExecutionProvenance`

## JsonValue

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:2:1`

A JSON value that can be stored in a portable Rules configuration or finding.

## readRulesConfigAsync

Kind: `function`
Module: `src/features/configuration/composition/readRulesConfigAsync.ts`
Source: `src/features/configuration/composition/readRulesConfigAsync.ts:6:1`

Wire the configuration source reader into the public file-validation operation.

### Signatures

- `(path: string) => Promise<RulesConfigReadResult>`
  - path: `string`
  - returns: `Promise<RulesConfigReadResult>`

## resolveRulesStatus

Kind: `function`
Module: `src/features/evaluation/domain/resolveRulesStatus.ts`
Source: `src/features/evaluation/domain/resolveRulesStatus.ts:4:1`

Summarize the complete Rules evaluation result without treating failed evaluation as canonical.

### Signatures

- `(result: Pick<RuleEvaluationResult, "diagnostics" | "findings" | "results">) => RulesStatusDescriptor`
  - result: `Pick<RuleEvaluationResult, "diagnostics" | "findings" | "results">`
  - returns: `RulesStatusDescriptor`

## Rule

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:148:1`

A deterministic, provider-owned policy unit evaluated by the generic engine.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| defaultSeverity | property | `RuleSeverity` | yes |  |
| dependencies | property | `readonly RuleDependency[]` | yes |  |
| evaluate | method | `(input: RuleEvaluationInput<TContext, TOptions>) => RuleEvaluationOutcome<TEvidence>` | yes |  |
| facets | property | `readonly RuleFacet[] \| undefined` | no |  |
| identity | property | `RuleIdentity` | yes |  |
| requiredCapabilities | property | `readonly string[] \| undefined` | no |  |
| summary | property | `string` | yes |  |
| validateOptions | method | `((options: JsonValue \| undefined) => readonly RuleOptionDiagnostic[]) \| undefined` | no |  |

## RuleCapability

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:6:1`

A capability that a rule needs from the context supplied by its consumer.

## RuleDependency

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:22:1`

One dependency declared by stable rule ID and resolved by the generic evaluator.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| ruleId | property | `string` | yes |  |

## RuleEvaluationCache

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:328:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| read | method | `(key: RuleEvaluationCacheKey) => RuleResult \| undefined` | yes |  |
| write | method | `(key: RuleEvaluationCacheKey, result: RuleResult) => void` | yes |  |

## RuleEvaluationCacheKey

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:317:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| capabilities | property | `readonly string[]` | yes |  |
| dependencyResults | property | `readonly RuleResult[]` | yes |  |
| factsVersion | property | `string` | yes |  |
| options | property | `JsonValue \| undefined` | yes |  |
| partition | property | `RuleEvaluationCachePartition` | yes |  |
| rule | property | `RuleIdentity` | yes |  |
| scope | property | `RuleScope` | yes |  |

## RuleEvaluationCachePartition

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:311:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| projectId | property | `string` | yes |  |
| tenantId | property | `string` | yes |  |

## RuleEvaluationDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:225:1`

One execution diagnostic that explains why a configured rule could not run.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"ambiguous-rule-id" \| "cycle" \| "dependency-error" \| "dependency-incomplete" \| "dependency-scope-mismatch" \| "disabled-dependency" \| "invalid-config" \| "invalid-options" \| "missing-capability" \| "missing-dependency" \| "rule-error" \| "unresolved-dependencies" \| "unknown-rule"` | yes |  |
| message | property | `string` | yes |  |
| ruleId | property | `string` | yes |  |

## RuleEvaluationInput

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:140:1`

The immutable input supplied to a rule after the evaluator has resolved its dependencies.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| context | property | `TContext` | yes |  |
| dependencyResults | property | `readonly RuleResult[]` | yes |  |
| options | property | `TOptions \| undefined` | yes |  |
| scope | property | `RuleScope` | yes |  |

## RuleEvaluationOutcome

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:77:1`

One provider result that is independent of evaluation failure and later policy decisions.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| findings | property | `readonly RuleFinding<TEvidence>[]` | yes |  |
| status | property | `"FAIL" \| "INCOMPLETE" \| "PASS"` | yes |  |

## RuleEvaluationPlan

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:133:1`

A consumer-neutral projection of selected rule roots and their resolved dependency closure.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| diagnostics | property | `readonly RuleEvaluationDiagnostic[]` | yes |  |
| nodes | property | `readonly RuleEvaluationPlanNode[]` | yes |  |
| rootRuleIds | property | `readonly string[]` | yes |  |

## RuleEvaluationPlanFacet

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:117:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| value | property | `string` | yes |  |
| version | property | `string` | yes |  |

## RuleEvaluationPlanNode

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:124:1`

One serializable node in the deterministic execution graph for a scoped Rules run.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| dependencyRuleIds | property | `readonly string[]` | yes |  |
| facets | property | `readonly RuleEvaluationPlanFacet[]` | yes |  |
| id | property | `string` | yes |  |
| rule | property | `RuleIdentity` | yes |  |
| scope | property | `RuleScope` | yes |  |

## RuleEvaluationResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:245:1`

The deterministic generic result shared by every Rules consumer.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| diagnostics | property | `readonly RuleEvaluationDiagnostic[]` | yes |  |
| findings | property | `readonly RuleFinding<JsonValue>[]` | yes |  |
| plan | property | `RuleEvaluationPlan` | yes |  |
| results | property | `readonly RuleResult[]` | yes |  |

## RuleExecutionProvenance

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:114:1`

## RuleFacet

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:15:1`

A provider-owned, stable facet used to classify rules without prescribing presentation.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| value | property | `string` | yes |  |
| version | property | `string \| undefined` | no |  |

## RuleFinding

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:60:1`

One serializable, consumer-neutral result produced by a rule.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| evidence | property | `TEvidence` | yes |  |
| message | property | `string` | yes |  |
| ruleId | property | `string` | yes |  |
| severity | property | `RuleSeverity` | yes |  |
| sourceLocation | property | `RuleSourceLocation \| undefined` | no |  |
| subjects | property | `readonly RuleSubject[]` | yes |  |

## RuleIdentity

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:9:1`

A stable, versioned identity for one provider-owned policy definition.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| version | property | `string` | yes |  |

## RuleOptionDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:70:1`

A validation error returned by a provider for its own serializable options.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `string` | yes |  |
| message | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |

## RulePolicy

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:262:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| profiles | property | `readonly RulePolicyProfile[]` | yes |  |

## RulePolicyDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:281:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"ambiguous-required-result" \| "incomplete-required-result" \| "missing-required-plan-node" \| "missing-required-result" \| "missing-required-root" \| "required-evaluation-diagnostic" \| "required-root-not-selected"` | yes |  |
| message | property | `string` | yes |  |
| profile | property | `Pick<RulePolicyProfile, "id" \| "version">` | yes |  |
| ruleId | property | `string` | yes |  |

## RulePolicyProfile

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:253:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| mode | property | `"advisory" \| "required"` | yes |  |
| rootRuleIds | property | `readonly string[]` | yes |  |
| severityThreshold | property | `RuleSeverity` | yes |  |
| version | property | `string` | yes |  |

## RulePolicyProfileReport

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:296:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| decision | property | `"PASS" \| "ADVISORY" \| "BLOCK"` | yes |  |
| diagnostics | property | `readonly RulePolicyDiagnostic[]` | yes |  |
| profile | property | `RulePolicyProfile` | yes |  |
| results | property | `readonly RuleResult[]` | yes |  |

## RulePolicyProvenance

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:267:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| commitSha | property | `string` | yes |  |
| configHash | property | `string` | yes |  |
| factsHash | property | `string` | yes |  |

## RulePolicyReport

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:304:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| decision | property | `"FAIL" \| "PASS"` | yes |  |
| profiles | property | `readonly RulePolicyProfileReport[]` | yes |  |
| provenance | property | `RulePolicyProvenance` | yes |  |

## RuleRegistry

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:170:1`

A registry that resolves rules without provider discovery or domain-specific branches.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| ruleById | property | `ReadonlyMap<string, Rule<TContext, JsonValue, JsonValue>>` | yes |  |
| rules | property | `readonly Rule<TContext, JsonValue, JsonValue>[]` | yes |  |
| ruleSets | property | `readonly RuleSet<TContext>[]` | yes |  |

## RuleResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:103:1`

One serializable evaluation result for a versioned rule at one exact semantic scope.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| diagnostics | property | `readonly RuleResultDiagnostic[]` | yes |  |
| execution | property | `RuleExecutionProvenance \| undefined` | no |  |
| findings | property | `readonly RuleFinding<JsonValue>[]` | yes |  |
| rule | property | `RuleIdentity` | yes |  |
| scope | property | `RuleScope` | yes |  |
| status | property | `RuleResultStatus` | yes |  |

## RuleResultDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:83:1`

A serializable diagnostic emitted by the evaluator while resolving a rule instance.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"ambiguous-rule-id" \| "cycle" \| "dependency-error" \| "dependency-incomplete" \| "dependency-scope-mismatch" \| "disabled-dependency" \| "invalid-config" \| "invalid-options" \| "missing-capability" \| "missing-dependency" \| "rule-error" \| "unresolved-dependencies" \| "unknown-rule"` | yes |  |
| message | property | `string` | yes |  |
| ruleId | property | `string \| undefined` | no |  |

## RuleResultStatus

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:38:1`

The complete deterministic state of one evaluated rule instance.

## RulesConfig

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:185:1`

The canonical JSON-only configuration stored in a repository rules.json file.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| rules | property | `readonly RulesConfigRule[]` | yes |  |
| version | property | `1` | yes |  |

## RulesConfigDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:191:1`

A portable diagnostic emitted while parsing or applying a Rules configuration.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"invalid-config" \| "invalid-options" \| "missing-capability" \| "rule-error" \| "unknown-rule" \| "invalid-rule-id" \| "invalid-severity"` | yes |  |
| message | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |
| ruleId | property | `string \| undefined` | no |  |

## RulesConfigReadResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:218:1`

The result of reading a repository rules.json file without hiding parse failures.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| config | property | `RulesConfig \| null` | yes |  |
| diagnostics | property | `readonly RulesConfigDiagnostic[]` | yes |  |
| path | property | `string` | yes |  |

## RulesConfigRule

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:177:1`

One enabled/disabled rule selection with serializable provider options.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| enabled | property | `boolean` | yes |  |
| id | property | `string` | yes |  |
| options | property | `JsonValue \| undefined` | no |  |
| severity | property | `RuleSeverity \| undefined` | no |  |

## RulesConfigValidationOptions

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:212:1`

Extra facts used to validate configured rule IDs, options, and required capabilities.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| capabilities | property | `readonly string[] \| undefined` | no |  |
| registry | property | `RuleRegistry<TContext> \| undefined` | no |  |

## RulesConfigValidationResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:206:1`

The result of validating a raw JSON configuration against optional provider knowledge.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| config | property | `RulesConfig \| null` | yes |  |
| diagnostics | property | `readonly RulesConfigDiagnostic[]` | yes |  |

## RuleScope

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:32:1`

The semantic target for a rule execution, independent of host tenancy or storage.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| kind | property | `string` | yes |  |

## RuleSelection

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:27:1`

Explicit roots selected for a run; dependency closure is evaluator-owned and never provider-owned.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| rootRuleIds | property | `readonly string[]` | yes |  |

## RuleSet

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:164:1`

A named collection of independently supplied rules that can compose with other providers.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| rules | property | `readonly Rule<TContext, JsonValue, JsonValue>[]` | yes |  |

## RuleSeverity

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:41:1`

The canonical impact levels used by every Rules provider.

## RuleSourceLocation

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:51:1`

An optional source location supplied as factual evidence by a provider.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| column | property | `number \| undefined` | no |  |
| endColumn | property | `number \| undefined` | no |  |
| endLine | property | `number \| undefined` | no |  |
| line | property | `number` | yes |  |
| path | property | `string` | yes |  |

## RulesStatusDescriptor

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:355:1`

A stable status summary suitable for consumer-specific presentation.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| color | property | `"green" \| "red" \| "yellow"` | yes |  |
| status | property | `"canonical" \| "invalid" \| "warnings"` | yes |  |

## RuleSubject

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:44:1`

An affected semantic subject reported independently of any presentation consumer.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| kind | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |

## validateRulesConfig

Kind: `function`
Module: `src/features/configuration/domain/validateRulesConfig.ts`
Source: `src/features/configuration/domain/validateRulesConfig.ts:15:1`

Validate canonical rules.json data, optionally against a concrete rule registry.

### Signatures

- `(value: unknown, options?: RulesConfigValidationOptions<TContext>) => RulesConfigValidationResult`
  - options: `RulesConfigValidationOptions<TContext>` (optional)
  - value: `unknown`
  - returns: `RulesConfigValidationResult`

## writeRulesConfigAsync

Kind: `function`
Module: `src/features/configuration/adapters/filesystem/writeRulesConfigAsync.ts`
Source: `src/features/configuration/adapters/filesystem/writeRulesConfigAsync.ts:8:1`

Validate and atomically write canonical rules.json configuration through the filesystem adapter.

### Signatures

- `(path: string, config: RulesConfig) => Promise<void>`
  - config: `RulesConfig`
  - path: `string`
  - returns: `Promise<void>`
