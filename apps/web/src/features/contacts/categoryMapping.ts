/**
 * Single source of truth for ContactCategory Hebrew ↔ DB enum mapping.
 *
 * The database stores English enum values (CustomerPrimary, Supplier, …).
 * The UI works entirely with Hebrew labels (לקוחות, ספקים, …).
 * All translation happens at the API client boundary so no other file needs to care.
 */

export const CATEGORY_TO_ENUM: Record<string, string> = {
  'לקוחות':         'CustomerPrimary',
  'נציגי לקוחות':  'CustomerRepresentative',
  'ספקים':          'Supplier',
  'שותפים עסקיים': 'BusinessPartner',
  'קבלנים':         'Contractor',
  'אחר':            'Other',
};

/** Reverse map — also covers legacy values that may exist in older DB records. */
export const ENUM_TO_CATEGORY: Record<string, string> = {
  CustomerPrimary:          'לקוחות',
  CustomerRepresentative:   'נציגי לקוחות',
  Supplier:                 'ספקים',
  BusinessPartner:          'שותפים עסקיים',
  Contractor:               'קבלנים',
  Other:                    'אחר',
  // Legacy values — map to nearest Hebrew equivalent so old records display correctly
  Consultant:               'שותפים עסקיים',
  Architect:                'שותפים עסקיים',
};

/**
 * Converts a Hebrew UI label to the DB enum value before writing to the API.
 * Unknown values are passed through unchanged so the API can surface the error.
 */
export function categoryToEnum(hebrewLabel: string): string {
  return CATEGORY_TO_ENUM[hebrewLabel] ?? hebrewLabel;
}

/**
 * Converts a DB enum value to the Hebrew UI label after reading from the API.
 * Unknown values are passed through unchanged so they remain visible rather than silently lost.
 */
export function enumToCategory(enumValue: string): string {
  return ENUM_TO_CATEGORY[enumValue] ?? enumValue;
}
