import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Feature set shared by every table in the app.
 *
 * v9 no longer bundles features automatically: a table only has the APIs whose
 * features it registers here, and a missing method at runtime almost always
 * means a missing registration rather than a removed API. Both tables paginate
 * and do nothing else — no sorting, filtering or selection — so this stays
 * near-minimal. `rowPaginationFeature` must precede the `paginatedRowModel`
 * slot it backs. `columnVisibilityFeature` is what puts `getVisibleCells()` on
 * a row; no column is ever actually hidden, but the render loop asks for cells
 * through it.
 *
 * Shared rather than declared per component so the `TFeatures` type argument
 * threaded through `ColumnDef` cannot drift between tables.
 */
export const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type Features = typeof features;
