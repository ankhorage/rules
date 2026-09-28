/*** A JSON value that can be stored in a portable Rules configuration or finding. */
export type JsonValue =
  boolean | null | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/*** A capability that a rule needs from the context supplied by its consumer. */
export type RuleCapability = string;

/*** The canonical impact levels used by every Rules provider. */
export type RuleSeverity = 'error' | 'info' | 'warning';

/*** An affected semantic subject reported independently of any presentation consumer. */
export interface RuleSubject {
  readonly id: string;
  readonly kind: string;
  readonly path?: string;
}

/*** An optional source location supplied as factual evidence by a provider. */
export interface RuleSourceLocation {
  readonly column?: number;
  readonly endColumn?: number;
  readonly endLine?: number;
  readonly line: number;
  readonly path: string;
}

/*** One serializable, consumer-neutral result produced by a rule. */
export interface RuleFinding<TEvidence extends JsonValue = JsonValue> {
  readonly evidence: TEvidence;
  readonly message: string;
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly sourceLocation?: RuleSourceLocation;
  readonly subjects: readonly RuleSubject[];
}

/*** A validation error returned by a provider for its own serializable options. */
export interface RuleOptionDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

/*** A deterministic, provider-owned policy unit evaluated by the generic engine. */
export interface Rule<
  TContext = unknown,
  TOptions extends JsonValue = JsonValue,
  TEvidence extends JsonValue = JsonValue,
> {
  readonly defaultSeverity: RuleSeverity;
  evaluate(input: {
    readonly context: TContext;
    readonly options: TOptions | undefined;
  }): readonly RuleFinding<TEvidence>[];
  readonly id: string;
  readonly requiredCapabilities?: readonly RuleCapability[];
  readonly summary: string;
  validateOptions?(options: JsonValue | undefined): readonly RuleOptionDiagnostic[];
}

/*** A named collection of independently supplied rules that can compose with other providers. */
export interface RuleSet<TContext = unknown> {
  readonly id: string;
  readonly rules: readonly Rule<TContext>[];
}

/*** A registry that resolves rules without provider discovery or domain-specific branches. */
export interface RuleRegistry<TContext = unknown> {
  readonly ruleSets: readonly RuleSet<TContext>[];
  readonly rules: readonly Rule<TContext>[];
  readonly ruleById: ReadonlyMap<string, Rule<TContext>>;
}

/*** One enabled/disabled rule selection with serializable provider options. */
export interface RulesConfigRule {
  readonly enabled: boolean;
  readonly id: string;
  readonly options?: JsonValue;
  readonly severity?: RuleSeverity;
}

/*** The canonical JSON-only configuration stored in a repository rules.json file. */
export interface RulesConfig {
  readonly rules: readonly RulesConfigRule[];
  readonly version: 1;
}

/*** A portable diagnostic emitted while parsing or applying a Rules configuration. */
export interface RulesConfigDiagnostic {
  readonly code:
    | 'invalid-config'
    | 'invalid-options'
    | 'invalid-rule-id'
    | 'invalid-severity'
    | 'missing-capability'
    | 'unknown-rule';
  readonly message: string;
  readonly path?: string;
  readonly ruleId?: string;
}

/*** The result of validating a raw JSON configuration against optional provider knowledge. */
export interface RulesConfigValidationResult {
  readonly config: RulesConfig | null;
  readonly diagnostics: readonly RulesConfigDiagnostic[];
}

/*** Extra facts used to validate configured rule IDs, options, and required capabilities. */
export interface RulesConfigValidationOptions<TContext = unknown> {
  readonly capabilities?: readonly RuleCapability[];
  readonly registry?: RuleRegistry<TContext>;
}

/*** The result of reading a repository rules.json file without hiding parse failures. */
export interface RulesConfigReadResult {
  readonly config: RulesConfig | null;
  readonly diagnostics: readonly RulesConfigDiagnostic[];
  readonly path: string;
}

/*** One execution diagnostic that explains why a configured rule could not run. */
export interface RuleEvaluationDiagnostic {
  readonly code: 'invalid-config' | 'invalid-options' | 'missing-capability' | 'unknown-rule';
  readonly message: string;
  readonly ruleId: string;
}

/*** The deterministic generic result shared by every Rules consumer. */
export interface RuleEvaluationResult {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly findings: readonly RuleFinding[];
}

/*** Direct evaluator inputs that are independent of any repository configuration format. */
export interface EvaluateRulesOptions {
  readonly capabilities?: readonly RuleCapability[];
  readonly optionsByRuleId?: ReadonlyMap<string, JsonValue | undefined>;
}

/*** Configured evaluator inputs that preserve the caller's explicit capability set. */
export interface EvaluateConfiguredRulesOptions {
  readonly capabilities?: readonly RuleCapability[];
}

/*** A stable status summary suitable for consumer-specific presentation. */
export interface RulesStatusDescriptor {
  readonly color: 'green' | 'red' | 'yellow';
  readonly status: 'canonical' | 'invalid' | 'warnings';
}
