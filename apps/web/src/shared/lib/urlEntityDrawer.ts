// Pure helpers backing the URL-driven entity drawer pattern. The query string is the single
// source of truth for the drawer: whether it is closed, open for creating a new record, or open
// reviewing an existing record. These functions translate the raw parameter into a validated
// state, resolve an existing id against loaded data (with a saved-record fallback), and produce
// the next URLSearchParams for every transition. Keeping them pure makes the whole contract unit
// testable without a DOM renderer.

// Reserved parameter value that represents "the drawer is open in create mode". Real records use
// positive integer ids, so this value can never collide with an existing record.
export const CREATE_ENTITY_PARAM_VALUE = 'new';

export type EntityDrawerUrlState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'existing'; id: number };

// Parse a raw query-string value into a positive integer entity id, or null when it is not a valid
// id (so malformed deep links fail safely). The raw value is matched exactly, WITHOUT trimming:
// only plain ASCII decimal digits with a first digit of 1-9 (no leading zeros, no bare zero) are
// accepted. This rejects signs, decimal points, scientific notation (1e3), hexadecimal (0x10), and
// any surrounding whitespace — including a "+" that URLSearchParams decodes into a leading space
// (e.g. "?id=+5" → " 5"), which trimming would otherwise wrongly accept. The value must also be a
// safe integer, so ids beyond Number.MAX_SAFE_INTEGER fail safely.
export function parseEntityIdParam(raw: string | null): number | null {
  if (raw == null) return null;
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// Interpret the drawer parameter into an explicit drawer state, matching the raw value exactly
// (no trimming). Create mode is opened only by the exact reserved value "new"; a strictly valid
// positive integer opens the matching record; anything else (missing/blank/whitespace/invalid,
// including " new ") keeps the drawer closed so malformed links fail safely.
export function parseEntityDrawerParam(raw: string | null): EntityDrawerUrlState {
  if (raw == null) return { kind: 'closed' };
  if (raw === CREATE_ENTITY_PARAM_VALUE) return { kind: 'create' };
  const id = parseEntityIdParam(raw);
  return id != null ? { kind: 'existing', id } : { kind: 'closed' };
}

// Resolve a validated id against the loaded collection. Returns null while data is still loading
// (items undefined), when there is no id, or when no record matches — the drawer stays closed
// until the requested record is actually available.
export function selectEntityById<T>(
  items: readonly T[] | undefined,
  id: number | null,
  getId: (entity: T) => number,
): T | null {
  if (id == null || items == null) return null;
  return items.find((entity) => getId(entity) === id) ?? null;
}

// A just-saved record shown until the list refresh arrives. It captures the exact `items` reference
// observed when the save happened, so the fallback is only trusted while the list is still that same
// pre-refresh array.
export interface PendingEntityFallback<T> {
  entity: T;
  itemsRef: readonly T[] | undefined;
}

// Resolve the entity to display for the requested id. During the pre-refresh window the freshly
// saved record wins: when the URL still requests the pending record's id AND the current list is
// still the exact pre-refresh reference captured at save time, the pending entity is returned even
// if the (stale) pre-refresh list already contains an older version of that record — so an update's
// new values show immediately. Once any refreshed list arrives (a different reference) the fallback
// expires and the loaded list becomes authoritative: a present record returns the refreshed record,
// an absent one returns null (never the old snapshot). A different requested id or a closed drawer
// also ignores the fallback, so stale identity can never leak into another view.
export function resolveDrawerEntity<T>(
  items: readonly T[] | undefined,
  requestedId: number | null,
  getId: (entity: T) => number,
  pending: PendingEntityFallback<T> | null,
): T | null {
  if (
    pending != null &&
    requestedId != null &&
    getId(pending.entity) === requestedId &&
    items === pending.itemsRef
  ) {
    return pending.entity;
  }
  return selectEntityById(items, requestedId, getId);
}

// Build the next query string for a target drawer state: create sets the reserved value, an
// existing record sets its id, and closed removes the parameter entirely (normalizing the URL).
// All unrelated params are preserved.
export function buildEntityDrawerSearchParams(
  current: URLSearchParams,
  paramName: string,
  state: EntityDrawerUrlState,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (state.kind === 'closed') {
    next.delete(paramName);
  } else if (state.kind === 'create') {
    next.set(paramName, CREATE_ENTITY_PARAM_VALUE);
  } else {
    next.set(paramName, String(state.id));
  }
  return next;
}
