// Centralized resolution of inventory category names to a representative image.
// Inventory categories are plain-text values (no DB entity), so this map is the single
// source of truth for category imagery. Names are normalized before matching so minor
// spacing/quote differences still resolve, and unknown categories fall back to a generic image.

const CATEGORY_IMAGE_BASE = `${import.meta.env.BASE_URL}inventory-categories`;

export const FALLBACK_CATEGORY_IMAGE = `${CATEGORY_IMAGE_BASE}/fallback.webp`;

// Display label for the bucket of items that have no category set.
export const UNCATEGORIZED_LABEL = 'ללא קטגוריה';

// Single source of truth for the eight canonical inventory categories, in display order.
// Every Inventory category selector, overview card, filter and image mapping derives from this list.
export const CANONICAL_CATEGORIES = [
  'חשמל חכם',
  'מולטימדיה',
  'שו"ב',
  'רשת מחשבים',
  'מצלמות אבטחה',
  'מערכות אזעקה',
  'טלפוניה ואינטרקום',
  'כבילה ותשתיות',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

// Canonical category → bundled representative image file.
const CATEGORY_IMAGE_FILES: Record<CanonicalCategory, string> = {
  'חשמל חכם': 'smart-electrical.webp',
  'מולטימדיה': 'multimedia.webp',
  'שו"ב': 'control-monitoring.webp',
  'רשת מחשבים': 'networking.webp',
  'מצלמות אבטחה': 'security-cameras.webp',
  'מערכות אזעקה': 'alarm-systems.webp',
  'טלפוניה ואינטרקום': 'telephony-intercom.webp',
  'כבילה ותשתיות': 'cabling-infrastructure.webp',
};

// User-facing category label; empty/blank category values render as the uncategorized label.
export function categoryDisplayName(name: string | null | undefined): string {
  return name && name.trim() ? name : UNCATEGORIZED_LABEL;
}

// Lowercase, strip quote-like characters, and remove whitespace so equivalent
// category labels resolve to the same key regardless of minor formatting.
export function normalizeCategoryName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/["'\u05f3\u05f4\u2018\u2019\u201c\u201d]/g, '')
    .replace(/\s+/g, '');
}

const CATEGORY_IMAGE_LOOKUP: ReadonlyMap<string, string> = new Map(
  CANONICAL_CATEGORIES.map((name) => [
    normalizeCategoryName(name),
    `${CATEGORY_IMAGE_BASE}/${CATEGORY_IMAGE_FILES[name]}`,
  ]),
);

const CANONICAL_LOOKUP: ReadonlyMap<string, CanonicalCategory> = new Map(
  CANONICAL_CATEGORIES.map((name) => [normalizeCategoryName(name), name]),
);

// Returns the canonical spelling for a value that matches one of the eight categories
// (tolerating whitespace/quote differences), or null when it is not a canonical category.
export function resolveCanonicalCategory(
  name: string | null | undefined,
): CanonicalCategory | null {
  return CANONICAL_LOOKUP.get(normalizeCategoryName(name)) ?? null;
}

export function isCanonicalCategory(name: string | null | undefined): boolean {
  return resolveCanonicalCategory(name) !== null;
}

// Always returns a usable image URL: the mapped category image, or the generic fallback.
export function resolveCategoryImage(category: string | null | undefined): string {
  const normalized = normalizeCategoryName(category);
  return CATEGORY_IMAGE_LOOKUP.get(normalized) ?? FALLBACK_CATEGORY_IMAGE;
}
