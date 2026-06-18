// Centralized product-image resolver. Every product-level image in the Inventory UI must go
// through this module so the resolution order lives in exactly one place:
//
//   uploaded product image  →  seeded SKU-specific product image  →  explicit missing state
//
// It must NEVER fall back to a category image. Do not call resolveCategoryImage() for products.

import { getSeededProductImage } from '../data/productImageCatalog';
import type { ProductImageMatchType } from '../data/productImageCatalog';
import type { InventoryItem } from '../types';

// Shown in the explicit missing-image state for an individual product (never a category photo).
export const MISSING_PRODUCT_IMAGE_LABEL = 'אין תמונת מוצר';

export type ProductImageSource = 'uploaded' | 'seeded' | 'none';

export interface ResolvedProductImage {
  // Ordered candidate URLs to try, highest priority first. Empty when no product image exists.
  sources: string[];
  // The source type of the highest-priority candidate (what we expect to show first).
  primarySource: ProductImageSource;
  // matchType of the seeded asset, when one participates in the chain (internal/debug only).
  seededMatchType: ProductImageMatchType | null;
}

interface ProductImageInput {
  skuCode?: string | null;
  imageUrl?: string | null;
}

// Builds the ordered product-image candidate list for an item:
// 1) uploaded image URL (when present), 2) seeded SKU image (when available).
// The consumer renders the explicit missing state when every candidate fails or none exist.
export function resolveProductImage(item: ProductImageInput): ResolvedProductImage {
  const sources: string[] = [];

  const uploaded = item.imageUrl?.trim();
  if (uploaded) sources.push(uploaded);

  const seeded = getSeededProductImage(item.skuCode);
  if (seeded) sources.push(seeded.url);

  const primarySource: ProductImageSource = uploaded
    ? 'uploaded'
    : seeded
      ? 'seeded'
      : 'none';

  return {
    sources,
    primarySource,
    seededMatchType: seeded?.matchType ?? null,
  };
}

// Convenience for the common case (a full InventoryItem).
export function resolveInventoryItemImage(item: InventoryItem): ResolvedProductImage {
  return resolveProductImage({ skuCode: item.skuCode, imageUrl: item.imageUrl });
}
