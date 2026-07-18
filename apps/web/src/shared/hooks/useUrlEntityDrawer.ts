import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildEntityDrawerSearchParams,
  parseEntityDrawerParam,
  resolveDrawerEntity,
  type PendingEntityFallback,
} from '@shared/lib/urlEntityDrawer';

export interface UrlEntityDrawerController<T> {
  /** True when the review drawer (existing record) or the create drawer is open. */
  isDrawerOpen: boolean;
  /** True when the drawer is open for creating a new record (URL parameter === "new"). */
  isCreating: boolean;
  /** The record resolved from the query parameter and loaded data (or saved fallback), or null. */
  selectedEntity: T | null;
  /** The record id currently highlighted in the list (null when creating/closed). */
  selectedId: number | null;
  /** Open an existing record for review (row click); reflected in the URL. */
  openEntity: (entity: T) => void;
  /** Open the create drawer; writes the reserved create value to the URL. */
  openCreate: () => void;
  /** Point the drawer at a (freshly saved) record; used by onSaved handlers. */
  showEntity: (entity: T) => void;
  /** Close the drawer and normalize the URL by removing the record parameter. */
  close: () => void;
}

/**
 * Drives an entity review/create drawer entirely from a single query parameter, which is the sole
 * source of truth for the drawer state: absent → closed, "new" → create, positive integer →
 * review that record. Because create mode also lives in the URL, browser back/forward moves
 * correctly between closed, create, and existing-record states, and a deep link opens the right
 * state on arrival.
 *
 * No effect ever copies the URL into state — the drawer state is derived during render, and the URL
 * only changes in response to explicit user intent. The only local state is a saved-record
 * fallback: after a create/save the refreshed list may not yet contain the new record, so the
 * handler-supplied record is shown until the list catches up. The fallback captures the exact
 * pre-refresh `items` reference and is honored only while the URL still requests that id AND the
 * list is still that same reference; the first refreshed list expires it (an absent record then
 * resolves to null, never the old snapshot). openEntity, openCreate, and close also clear it
 * explicitly, so it can never leak into another record's view or survive a close.
 */
export function useUrlEntityDrawer<T>(config: {
  paramName: string;
  items: readonly T[] | undefined;
  getId: (entity: T) => number;
}): UrlEntityDrawerController<T> {
  const { paramName, items, getId } = config;
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<PendingEntityFallback<T> | null>(null);

  const urlState = parseEntityDrawerParam(searchParams.get(paramName));
  const isCreating = urlState.kind === 'create';
  const requestedId = urlState.kind === 'existing' ? urlState.id : null;

  const selectedEntity = resolveDrawerEntity(items, requestedId, getId, pending);
  const isDrawerOpen = isCreating || selectedEntity != null;

  const setDrawerParam = useCallback(
    (state: Parameters<typeof buildEntityDrawerSearchParams>[2], options?: { replace?: boolean }) => {
      setSearchParams(
        (current) => buildEntityDrawerSearchParams(current, paramName, state),
        { replace: options?.replace ?? false },
      );
    },
    [paramName, setSearchParams],
  );

  const openEntity = useCallback(
    (entity: T) => {
      setPending(null);
      setDrawerParam({ kind: 'existing', id: getId(entity) });
    },
    [getId, setDrawerParam],
  );

  const openCreate = useCallback(() => {
    setPending(null);
    setDrawerParam({ kind: 'create' });
  }, [setDrawerParam]);

  const showEntity = useCallback(
    (entity: T) => {
      // Keep the just-saved record visible until the refreshed list arrives. Capture the current
      // items reference so the fallback expires as soon as any new list result replaces it.
      setPending({ entity, itemsRef: items });
      setDrawerParam({ kind: 'existing', id: getId(entity) }, { replace: true });
    },
    [getId, items, setDrawerParam],
  );

  const close = useCallback(() => {
    setPending(null);
    setDrawerParam({ kind: 'closed' });
  }, [setDrawerParam]);

  return {
    isDrawerOpen,
    isCreating,
    selectedEntity,
    selectedId: selectedEntity ? getId(selectedEntity) : null,
    openEntity,
    openCreate,
    showEntity,
    close,
  };
}
