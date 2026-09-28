/*** Compare stable rule identifiers by code-unit order without locale-dependent collation. */
export function compareRuleIdentifier(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
