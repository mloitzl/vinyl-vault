/**
 * Escapes all PCRE/MongoDB regex metacharacters in a string so it can be
 * safely embedded inside a $regex value without unintended pattern behaviour.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
