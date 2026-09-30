/**
 * Paginate API list endpoints until all rows are loaded (or safety cap).
 * Used for bulk entry, reports PDF, agencies list, etc.
 */

export type PagePagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev?: boolean;
};

export type FetchAllPagesResult<T> = {
  items: T[];
  complete: boolean;
  loadedCount: number;
  expectedTotal: number | null;
};

export const DEFAULT_LIST_PAGE_SIZE = 500;
const SAFETY_MAX_ROWS = 500_000;

export async function fetchAllPages<T>(
  fetchPage: (
    page: number,
    pageSize: number,
  ) => Promise<{ items: T[]; pagination: PagePagination | null }>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<FetchAllPagesResult<T>> {
  const pageSize = options?.pageSize ?? DEFAULT_LIST_PAGE_SIZE;
  const maxRows = options?.maxRows ?? SAFETY_MAX_ROWS;
  const items: T[] = [];
  let page = 1;
  let expectedTotal: number | null = null;

  while (items.length < maxRows) {
    const { items: batch, pagination } = await fetchPage(page, pageSize);
    if (pagination?.total != null && Number.isFinite(pagination.total)) {
      expectedTotal = pagination.total;
    }
    items.push(...batch);

    if (expectedTotal != null && items.length >= expectedTotal) {
      return {
        items,
        complete: true,
        loadedCount: items.length,
        expectedTotal,
      };
    }

    if (!pagination?.hasNext || batch.length === 0) {
      // No more pages — we have everything the API will return. DB `total` can
      // exceed loaded rows when the server dedupes duplicate bulk rows in-memory.
      return {
        items,
        complete: true,
        loadedCount: items.length,
        expectedTotal: expectedTotal ?? items.length,
      };
    }

    if (
      expectedTotal != null &&
      items.length < expectedTotal &&
      batch.length < pageSize
    ) {
      // Short last page but hasNext still true would be inconsistent; treat as done.
      return {
        items,
        complete: true,
        loadedCount: items.length,
        expectedTotal,
      };
    }

    page += 1;
  }

  return {
    items,
    complete: false,
    loadedCount: items.length,
    expectedTotal,
  };
}
