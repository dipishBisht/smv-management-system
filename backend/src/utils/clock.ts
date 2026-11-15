/**
 * All business logic reads time through now(). The server clock is the single source of truth for
 * check-in/out timestamps (clients cannot supply their own), and tests can override it.
 */
let override: (() => Date) | null = null;
export const now = (): Date => (override ? override() : new Date());
export const setClock = (fn: (() => Date) | null) => {
  override = fn;
};
