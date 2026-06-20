// Product-image catalog: the single SKU-keyed source of truth for seeded (bundled) product
// photographs. This is deliberately separate from categoryImages.ts — category images are a
// category-level visual asset and must NEVER be used as an individual product's image.
//
// The catalog is derived from productImageManifest.json (machine-readable internal metadata).
// Seeded images are keyed by *normalized SkuCode*, never by InventoryItemId, because database
// ids differ between environments while SKUs are stable.

import manifest from './productImageManifest.json';

// matchType distinguishes how closely a seeded asset matches the real product.
export type ProductImageMatchType =
  | 'exact-model'
  | 'representative-product-family'
  | 'user-provided';

export interface ProductImageManifestEntry {
  skuCode: string;
  itemName: string;
  category: string;
  assetPath: string;
  productFamily: string;
  matchType: ProductImageMatchType;
  source: string;
  licenseNote: string;
  // false marks a documented slot still awaiting a license-clean real product photo at assetPath.
  // The runtime resolver treats unavailable assets as "no seeded image" so it never emits a URL
  // that would 404; the dev-time validation reports the missing file explicitly.
  assetAvailable: boolean;
}

export const EXPECTED_SKU_COUNT: number = manifest.expectedSkuCount;

export const PRODUCT_IMAGE_MANIFEST: readonly ProductImageManifestEntry[] =
  manifest.entries as ProductImageManifestEntry[];

// Normalize a SKU for stable lookups: trim + uppercase. SKUs may contain '/', '.', '-' which are
// all preserved so distinct SKUs never collide.
export function normalizeSkuCode(skuCode: string | null | undefined): string {
  return (skuCode ?? '').trim().toUpperCase();
}

// Only entries whose real asset is actually present are eligible for runtime resolution.
const SEEDED_IMAGE_LOOKUP: ReadonlyMap<string, ProductImageManifestEntry> = new Map(
  PRODUCT_IMAGE_MANIFEST.filter((entry) => entry.assetAvailable).map((entry) => [
    normalizeSkuCode(entry.skuCode),
    entry,
  ]),
);

export interface SeededProductImage {
  url: string;
  matchType: ProductImageMatchType;
}

// Returns the bundled product image for a SKU, or null when no seeded asset is available.
// Never falls back to a category image.
export function getSeededProductImage(
  skuCode: string | null | undefined,
): SeededProductImage | null {
  const entry = SEEDED_IMAGE_LOOKUP.get(normalizeSkuCode(skuCode));
  if (!entry) return null;
  return { url: entry.assetPath, matchType: entry.matchType };
}
