/*** A JSON value that can be stored in a portable Rules configuration or finding. */
export type JsonValue =
  boolean | null | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/*** A capability that a rule needs from the context supplied by its consumer. */
export type RuleCapability = string;

/*** A stable, versioned identity for one provider-owned policy definition. */
export interface RuleIdentity {
  readonly id: string;
  readonly version: string;
}

/*** A provider-owned, stable facet used to classify rules without prescribing presentation. */
export interface RuleFacet {
  readonly id: string;
  readonly value: string;
  readonly version?: string;
}

/*** One dependency declared by stable rule ID and resolved by the generic evaluator. */
export interface RuleDependency {
  readonly ruleId: string;
}

/*** Explicit roots selected for a run; dependency closure is evaluator-owned and never provider-owned. */
export interface RuleSelection {
  readonly rootRuleIds: readonly string[];
}

/*** The semantic target for a rule execution, independent of host tenancy or storage. */
export interface RuleScope {
  readonly id: string;
  readonly kind: string;
}

/*** The complete deterministic state of one evaluated rule instance. */
export type RuleResultStatus = 'ERROR' | 'FAIL' | 'INCOMPLETE' | 'PASS' | 'SKIPPED';

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

/*** One provider result that is independent of evaluation failure and later policy decisions. */
export interface RuleEvaluationOutcome<TEvidence extends JsonValue = JsonValue> {
  readonly findings: readonly RuleFinding<TEvidence>[];
  readonly status: 'FAIL' | 'INCOMPLETE' | 'PASS';
}

/*** A serializable diagnostic emitted by the evaluator while resolving a rule instance. */
export interface RuleResultDiagnostic {
  readonly code:
    | 'ambiguous-rule-id'
    | 'cycle'
    | 'dependency-error'
    | 'dependency-incomplete'
    | 'dependency-scope-mismatch'
    | 'disabled-dependency'
    | 'invalid-config'
    | 'invalid-options'
    | 'missing-capability'
    | 'missing-dependency'
    | 'rule-error'
    | 'unknown-rule'
    | 'unresolved-dependencies';
  readonly message: string;
  readonly ruleId?: string;
}

/*** One serializable evaluation result for a versioned rule at one exact semantic scope. */
export interface RuleResult {
  readonly diagnostics: readonly RuleResultDiagnostic[];
  /** An absent value represents unknown provenance in a legacy or externally restored result. */
  readonly execution?: RuleExecutionProvenance;
  readonly findings: readonly RuleFinding[];
  readonly rule: RuleIdentity;
  readonly scope: RuleScope;
  readonly status: RuleResultStatus;
}

/** Truthful evaluator provenance; consumers must never interpret unknown as cache reuse. */
export type RuleExecutionProvenance = 'cache-hit' | 'evaluated' | 'not-executed' | 'unknown';

/** A versioned facet projected from a provider rule into the serializable evaluation plan. */
export interface RuleEvaluationPlanFacet {
  readonly id: string;
  readonly value: string;
  readonly version: string;
}

/*** One serializable node in the deterministic execution graph for a scoped Rules run. */
export interface RuleEvaluationPlanNode {
  readonly dependencyRuleIds: readonly string[];
  readonly facets: readonly RuleEvaluationPlanFacet[];
  readonly id: string;
  readonly rule: RuleIdentity;
  readonly scope: RuleScope;
}

/*** A consumer-neutral projection of selected rule roots and their resolved dependency closure. */
export interface RuleEvaluationPlan {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly nodes: readonly RuleEvaluationPlanNode[];
  readonly rootRuleIds: readonly string[];
}

/*** The immutable input supplied to a rule after the evaluator has resolved its dependencies. */
export interface RuleEvaluationInput<TContext = unknown, TOptions extends JsonValue = JsonValue> {
  readonly context: TContext;
  readonly dependencyResults: readonly RuleResult[];
  readonly options: TOptions | undefined;
  readonly scope: RuleScope;
}

/*** A deterministic, provider-owned policy unit evaluated by the generic engine. */
export interface Rule<
  TContext = unknown,
  TOptions extends JsonValue = JsonValue,
  TEvidence extends JsonValue = JsonValue,
> {
  readonly defaultSeverity: RuleSeverity;
  readonly dependencies: readonly RuleDependency[];
  evaluate(input: RuleEvaluationInput<TContext, TOptions>): RuleEvaluationOutcome<TEvidence>;
  readonly facets?: readonly RuleFacet[];
  readonly identity: RuleIdentity;
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
    | 'rule-error'
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
  readonly code:
    | 'ambiguous-rule-id'
    | 'cycle'
    | 'dependency-error'
    | 'dependency-incomplete'
    | 'dependency-scope-mismatch'
    | 'disabled-dependency'
    | 'invalid-config'
    | 'invalid-options'
    | 'missing-capability'
    | 'missing-dependency'
    | 'rule-error'
    | 'unresolved-dependencies'
    | 'unknown-rule';
  readonly message: string;
  readonly ruleId: string;
}

/*** The deterministic generic result shared by every Rules consumer. */
export interface RuleEvaluationResult {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly findings: readonly RuleFinding[];
  readonly plan: RuleEvaluationPlan;
  readonly results: readonly RuleResult[];
}

/** A centrally owned policy profile that selects roots independently of repository configuration. */
export interface RulePolicyProfile {
  readonly id: string;
  readonly mode: 'advisory' | 'required';
  readonly rootRuleIds: readonly string[];
  readonly severityThreshold: RuleSeverity;
  readonly version: string;
}

/** The immutable caller-supplied policy that determines whether a completed run blocks CI. */
export interface RulePolicy {
  readonly profiles: readonly RulePolicyProfile[];
}

/** Provenance supplied by the host after it has acquired configuration and facts. */
export interface RulePolicyProvenance {
  readonly commitSha: string;
  readonly configHash: string;
  readonly factsHash: string;
}

/** The pure inputs required to turn an evaluation result into a portable CI decision. */
export interface EvaluateRulePolicyOptions {
  readonly evaluation: RuleEvaluationResult;
  readonly policy: RulePolicy;
  readonly provenance: RulePolicyProvenance;
}

/** A policy-level diagnostic that cannot be attributed to a provider-owned rule result. */
export interface RulePolicyDiagnostic {
  readonly code:
    | 'ambiguous-required-result'
    | 'incomplete-required-result'
    | 'missing-required-result'
    | 'missing-required-root'
    | 'required-evaluation-diagnostic'
    | 'required-root-not-selected';
  readonly message: string;
  readonly profile: Pick<RulePolicyProfile, 'id' | 'version'>;
  readonly ruleId: string;
}

/** The scoped result set and deterministic decision for one selected policy profile. */
export interface RulePolicyProfileReport {
  readonly decision: 'ADVISORY' | 'BLOCK' | 'PASS';
  readonly diagnostics: readonly RulePolicyDiagnostic[];
  readonly profile: RulePolicyProfile;
  readonly results: readonly RuleResult[];
}

/** A consumer-neutral report that contains all evidence used to make a CI gate decision. */
export interface RulePolicyReport {
  readonly decision: 'FAIL' | 'PASS';
  readonly profiles: readonly RulePolicyProfileReport[];
  readonly provenance: RulePolicyProvenance;
}

/** A host-authenticated partition that prevents cache reuse across tenants or projects. */
export interface RuleEvaluationCachePartition {
  readonly projectId: string;
  readonly tenantId: string;
}

/** The complete serializable evaluator-owned identity for one reusable rule outcome. */
export interface RuleEvaluationCacheKey {
  readonly capabilities: readonly RuleCapability[];
  readonly dependencyResults: readonly RuleResult[];
  readonly factsVersion: string;
  readonly options: JsonValue | undefined;
  readonly partition: RuleEvaluationCachePartition;
  readonly rule: RuleIdentity;
  readonly scope: RuleScope;
}

/** Optional storage adapter; Rules owns cache-key construction and cache-hit provenance. */
export interface RuleEvaluationCache {
  read(key: RuleEvaluationCacheKey): RuleResult | undefined;
  write(key: RuleEvaluationCacheKey, result: RuleResult): void;
}

/*** Direct evaluator inputs that are independent of any repository configuration format. */
export interface EvaluateRulesOptions {
  readonly cache?: RuleEvaluationCache;
  readonly cachePartition?: RuleEvaluationCachePartition;
  readonly capabilities?: readonly RuleCapability[];
  readonly disabledRuleIds?: readonly string[];
  readonly factsVersion?: string;
  readonly optionsByRuleId?: ReadonlyMap<string, JsonValue | undefined>;
  readonly selection?: RuleSelection;
  readonly scope?: RuleScope;
}

/*** Configured evaluator inputs that preserve caller capabilities and cache provenance. */
export interface EvaluateConfiguredRulesOptions extends Pick<
  EvaluateRulesOptions,
  'cache' | 'cachePartition' | 'factsVersion'
> {
  readonly capabilities?: readonly RuleCapability[];
  readonly scope?: RuleScope;
}

/*** A stable status summary suitable for consumer-specific presentation. */
export interface RulesStatusDescriptor {
  readonly color: 'green' | 'red' | 'yellow';
  readonly status: 'canonical' | 'invalid' | 'warnings';
}
