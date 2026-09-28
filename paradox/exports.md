# Public API

## createRuleRegistry

Kind: `function`
Module: `src/createRuleRegistry.ts`
Source: `src/createRuleRegistry.ts:4:1`

Create a deterministic registry from independently owned RuleSets.

### Signatures

- `(ruleSets: readonly RuleSet<TContext>[]) => RuleRegistry<TContext>`
  - ruleSets: `readonly RuleSet<TContext>[]`
  - returns: `RuleRegistry<TContext>`

## createRulesRuntimeProvider

Kind: `function`
Module: `src/cli/index.ts`
Source: `src/cli/index.ts:11:1`

Create the Ankh provider that exposes the generic JSON config validation operation.

### Signatures

- `() => AnkhRuntimeCommandProvider`
  - returns: `AnkhRuntimeCommandProvider`

## evaluateConfiguredRules

Kind: `function`
Module: `src/evaluateConfiguredRules.ts`
Source: `src/evaluateConfiguredRules.ts:13:1`

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
Source: `src/types/rules.ts:142:1`

Configured evaluator inputs that preserve the caller's explicit capability set.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| capabilities | property | `readonly string[] \| undefined` | no |  |

## evaluateRules

Kind: `function`
Module: `src/evaluateRules.ts`
Source: `src/evaluateRules.ts:11:1`

Evaluate unrelated rules in deterministic identifier order through one generic mechanism.

### Signatures

- `(context: TContext, rules: readonly Rule<TContext, import("./index.js").JsonValue, import("./index.js").JsonValue>[], options?: EvaluateRulesOptions) => RuleEvaluationResult`
  - context: `TContext`
  - options: `EvaluateRulesOptions` (optional)
  - rules: `readonly Rule<TContext, import("./index.js").JsonValue, import("./index.js").JsonValue>[]`
  - returns: `RuleEvaluationResult`

## EvaluateRulesOptions

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:136:1`

Direct evaluator inputs that are independent of any repository configuration format.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| capabilities | property | `readonly string[] \| undefined` | no |  |
| optionsByRuleId | property | `ReadonlyMap<string, JsonValue \| undefined> \| undefined` | no |  |

## JsonValue

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:2:1`

A JSON value that can be stored in a portable Rules configuration or finding.

## readRulesConfigAsync

Kind: `function`
Module: `src/readRulesConfigAsync.ts`
Source: `src/readRulesConfigAsync.ts:7:1`

Read and structurally validate a repository rules.json file.

### Signatures

- `(path: string) => Promise<RulesConfigReadResult>`
  - path: `string`
  - returns: `Promise<RulesConfigReadResult>`

## resolveRulesStatus

Kind: `function`
Module: `src/resolveRulesStatus.ts`
Source: `src/resolveRulesStatus.ts:4:1`

Summarize generic rule findings using the reusable status semantics formerly owned by Policy.

### Signatures

- `(findings: readonly Pick<RuleFinding<import("./index.js").JsonValue>, "severity">[]) => RulesStatusDescriptor`
  - findings: `readonly Pick<RuleFinding<import("./index.js").JsonValue>, "severity">[]`
  - returns: `RulesStatusDescriptor`

## Rule

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:45:1`

A deterministic, provider-owned policy unit evaluated by the generic engine.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| defaultSeverity | property | `RuleSeverity` | yes |  |
| evaluate | method | `(input: { readonly context: TContext; readonly options: TOptions \| undefined; }) => readonly RuleFinding<TEvidence>[]` | yes |  |
| id | property | `string` | yes |  |
| requiredCapabilities | property | `readonly string[] \| undefined` | no |  |
| summary | property | `string` | yes |  |
| validateOptions | method | `((options: JsonValue \| undefined) => readonly RuleOptionDiagnostic[]) \| undefined` | no |  |

## RuleCapability

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:6:1`

A capability that a rule needs from the context supplied by its consumer.

## RuleEvaluationDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:123:1`

One execution diagnostic that explains why a configured rule could not run.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"invalid-config" \| "invalid-options" \| "missing-capability" \| "unknown-rule"` | yes |  |
| message | property | `string` | yes |  |
| ruleId | property | `string` | yes |  |

## RuleEvaluationResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:130:1`

The deterministic generic result shared by every Rules consumer.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| diagnostics | property | `readonly RuleEvaluationDiagnostic[]` | yes |  |
| findings | property | `readonly RuleFinding<JsonValue>[]` | yes |  |

## RuleFinding

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:28:1`

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

## RuleOptionDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:38:1`

A validation error returned by a provider for its own serializable options.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `string` | yes |  |
| message | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |

## RuleRegistry

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:68:1`

A registry that resolves rules without provider discovery or domain-specific branches.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| ruleById | property | `ReadonlyMap<string, Rule<TContext, JsonValue, JsonValue>>` | yes |  |
| rules | property | `readonly Rule<TContext, JsonValue, JsonValue>[]` | yes |  |
| ruleSets | property | `readonly RuleSet<TContext>[]` | yes |  |

## RulesConfig

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:83:1`

The canonical JSON-only configuration stored in a repository rules.json file.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| rules | property | `readonly RulesConfigRule[]` | yes |  |
| version | property | `1` | yes |  |

## RulesConfigDiagnostic

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:89:1`

A portable diagnostic emitted while parsing or applying a Rules configuration.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `"invalid-config" \| "invalid-options" \| "missing-capability" \| "unknown-rule" \| "invalid-capability" \| "invalid-rule-id" \| "invalid-severity"` | yes |  |
| message | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |
| ruleId | property | `string \| undefined` | no |  |

## RulesConfigReadResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:116:1`

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
Source: `src/types/rules.ts:75:1`

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
Source: `src/types/rules.ts:110:1`

Extra facts used to validate configured rule IDs, options, and required capabilities.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| capabilities | property | `readonly string[] \| undefined` | no |  |
| registry | property | `RuleRegistry<TContext> \| undefined` | no |  |

## RulesConfigValidationResult

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:104:1`

The result of validating a raw JSON configuration against optional provider knowledge.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| config | property | `RulesConfig \| null` | yes |  |
| diagnostics | property | `readonly RulesConfigDiagnostic[]` | yes |  |

## RuleSet

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:62:1`

A named collection of independently supplied rules that can compose with other providers.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| rules | property | `readonly Rule<TContext, JsonValue, JsonValue>[]` | yes |  |

## RuleSeverity

Kind: `unknown`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:9:1`

The canonical impact levels used by every Rules provider.

## RuleSourceLocation

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:19:1`

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
Source: `src/types/rules.ts:147:1`

A stable status summary suitable for consumer-specific presentation.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| color | property | `"green" \| "red" \| "yellow"` | yes |  |
| status | property | `"canonical" \| "invalid" \| "warnings"` | yes |  |

## RuleSubject

Kind: `type`
Module: `src/types/rules.ts`
Source: `src/types/rules.ts:12:1`

An affected semantic subject reported independently of any presentation consumer.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | property | `string` | yes |  |
| kind | property | `string` | yes |  |
| path | property | `string \| undefined` | no |  |

## runCli

Kind: `function`
Module: `src/cli/standalone.ts`
Source: `src/cli/standalone.ts:8:1`

Run the standalone Rules config validator through the same public operation as the Ankh provider.

### Signatures

- `(argv: readonly string[]) => Promise<{ readonly exitCode: number; }>`
  - argv: `readonly string[]`
  - returns: `Promise<{ readonly exitCode: number; }>`

## validateRulesConfig

Kind: `function`
Module: `src/validateRulesConfig.ts`
Source: `src/validateRulesConfig.ts:14:1`

Validate canonical rules.json data, optionally against a concrete rule registry.

### Signatures

- `(value: unknown, options?: RulesConfigValidationOptions<TContext>) => RulesConfigValidationResult`
  - options: `RulesConfigValidationOptions<TContext>` (optional)
  - value: `unknown`
  - returns: `RulesConfigValidationResult`

## validateRulesConfigFileAsync

Kind: `function`
Module: `src/validateRulesConfigFileAsync.ts`
Source: `src/validateRulesConfigFileAsync.ts:7:1`

Validate one explicit or default rules.json path through the public configuration operation.

### Signatures

- `(inputPath: string | undefined, cwd: string) => Promise<RulesConfigReadResult>`
  - cwd: `string`
  - inputPath: `string | undefined`
  - returns: `Promise<RulesConfigReadResult>`

## writeRulesConfigAsync

Kind: `function`
Module: `src/writeRulesConfigAsync.ts`
Source: `src/writeRulesConfigAsync.ts:7:1`

Validate and atomically write canonical rules.json configuration.

### Signatures

- `(path: string, config: RulesConfig) => Promise<void>`
  - config: `RulesConfig`
  - path: `string`
  - returns: `Promise<void>`
