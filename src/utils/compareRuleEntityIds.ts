/*** Compare Rules-domain entities by identifier using locale-independent code-unit ordering. */
export function compareRuleEntityIds(
  left: { readonly id: string },
  right: { readonly id: string },
): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}
