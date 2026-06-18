#!/usr/bin/env node
// Development-time validation for the Inventory product-image catalog.
//
// Checks the machine-readable manifest (src/features/inventory/data/productImageManifest.json)
// against the known Inventory SKU list and the bundled assets under public/inventory-products.
//
// Two modes:
//   - standard (default): validates mapping integrity. FAILS only on a mapping problem (count
//     mismatch, duplicate, missing mapping, unknown entry) or on an entry marked
//     assetAvailable:true whose file is missing. Pending (assetAvailable:false) files that are not
//     yet on disk are reported but do NOT fail — they are expected during acquisition.
//   - strict (--strict): everything in standard mode PLUS every mapped asset file must exist on
//     disk (36/36). Use this gate for final completion.
//
// Run: node apps/web/scripts/validate-product-image-catalog.mjs [--strict]
//   or: npm run validate:inventory-images --workspace=apps/web
//   or: npm run validate:inventory-images:strict --workspace=apps/web

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const manifestPath = resolve(
  webRoot,
  'src/features/inventory/data/productImageManifest.json',
);
const publicRoot = resolve(webRoot, 'public');

// The authoritative known Inventory SKU list (36). The manifest is validated against this.
const KNOWN_SKUS = [
  'ELE-UPS-1500',
  'SH-DIMMER-KNX',
  'SH-RELAY-8CH',
  'ELE-PSU-12V10A',
  'HDL-M/DLP04.1-A2-46',
  'TEL-PHONE-IP',
  'TEL-PBX-IP',
  'INT-PANEL-IP',
  'INT-STATION',
  'NET-PATCHCORD2',
  'NET-FIBER-SM',
  'NET-CAT6-305',
  'ELE-CONDUIT-25',
  'AV-AMP-240',
  'AV-MIC-CONF',
  'AV-SCREEN-75',
  'AV-PROJ-LASER',
  'AV-SPK-CEIL6',
  'ALM-PIR',
  'FIRE-SMOKE-DET',
  'ALM-SIREN',
  'ALM-PANEL-8Z',
  'HDD-8TB',
  'CAM-PTZ-2MP',
  'CAM-DOME-4MP',
  'CAM-BULLET-8MP',
  'NVR-16CH',
  'NVR-32CH',
  'NET-RACK-42U',
  'NET-SWITCH-P24',
  'NET-ROUTER-ENT',
  'NET-PATCH-24',
  'BMS-CTRL-DDC',
  'ACS-CTRL-4DR',
  'ACS-MAGLOCK-600',
  'ACS-READER-RFID',
];

const normalizeSku = (sku) => (sku ?? '').trim().toUpperCase();

function assetFsPath(assetPath) {
  // assetPath is a public URL path like '/inventory-products/<cat>/<file>'.
  return resolve(publicRoot, assetPath.replace(/^\/+/, ''));
}

function main() {
  const strict = process.argv.includes('--strict');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = manifest.entries ?? [];
  const expectedCount = manifest.expectedSkuCount ?? KNOWN_SKUS.length;

  const knownSet = new Set(KNOWN_SKUS.map(normalizeSku));

  const seen = new Map();
  const duplicateSkus = [];
  for (const entry of entries) {
    const key = normalizeSku(entry.skuCode);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) duplicateSkus.push(key);
  }

  const mappedSkus = new Set(seen.keys());

  const missingMappings = KNOWN_SKUS.filter((sku) => !mappedSkus.has(normalizeSku(sku)));

  const unknownEntries = entries
    .filter((entry) => !knownSet.has(normalizeSku(entry.skuCode)))
    .map((entry) => entry.skuCode);

  const missingAssetFiles = entries
    .filter((entry) => !existsSync(assetFsPath(entry.assetPath)))
    .map((entry) => ({ skuCode: entry.skuCode, assetPath: entry.assetPath }));

  // Entries marked available but with no file on disk are ALWAYS an error: the manifest is lying.
  const availableButMissingFile = entries.filter(
    (entry) => entry.assetAvailable && !existsSync(assetFsPath(entry.assetPath)),
  );

  // Pending entries: assetAvailable:false and no file yet. Expected during acquisition.
  const pendingAssets = entries.filter(
    (entry) => !entry.assetAvailable && !existsSync(assetFsPath(entry.assetPath)),
  );

  const presentAssets = entries.length - missingAssetFiles.length;

  const mappingValid =
    entries.length === expectedCount &&
    KNOWN_SKUS.length === expectedCount &&
    duplicateSkus.length === 0 &&
    missingMappings.length === 0 &&
    unknownEntries.length === 0 &&
    availableButMissingFile.length === 0;

  // Standard mode tolerates pending assets; strict mode requires every file present.
  const ok = strict ? mappingValid && missingAssetFiles.length === 0 : mappingValid;

  console.log('Inventory product-image catalog validation');
  console.log(`Mode                 : ${strict ? 'STRICT (36/36 assets required)' : 'standard'}`);
  console.log('==========================================');
  console.log(`Expected SKUs        : ${expectedCount}`);
  console.log(`Known SKUs           : ${KNOWN_SKUS.length}`);
  console.log(`Mapped SKUs          : ${mappedSkus.size}`);
  console.log(`Manifest entries     : ${entries.length}`);
  console.log(`Duplicate mappings   : ${duplicateSkus.length}`);
  console.log(`Missing mappings     : ${missingMappings.length}`);
  console.log(`Unknown entries      : ${unknownEntries.length}`);
  console.log(`Assets present       : ${presentAssets}/${entries.length}`);
  console.log(`Pending real photos  : ${pendingAssets.length}`);
  console.log(`Marked-available but missing file : ${availableButMissingFile.length}`);

  if (duplicateSkus.length) {
    console.log('\nDuplicate SKU mappings:');
    duplicateSkus.forEach((sku) => console.log(`  - ${sku}`));
  }
  if (missingMappings.length) {
    console.log('\nKnown SKUs with no manifest mapping:');
    missingMappings.forEach((sku) => console.log(`  - ${sku}`));
  }
  if (unknownEntries.length) {
    console.log('\nManifest entries not in the known SKU list:');
    unknownEntries.forEach((sku) => console.log(`  - ${sku}`));
  }
  if (pendingAssets.length) {
    const heading = strict
      ? '\nFAIL (strict): pending real-photo assets — drop a licensed product photo at each path:'
      : '\nPending real-photo assets (expected; not a failure in standard mode):';
    console.log(heading);
    pendingAssets.forEach((entry) =>
      console.log(`  - ${entry.skuCode}  ->  public${entry.assetPath}`),
    );
  }
  if (availableButMissingFile.length) {
    console.log(
      '\nERROR: entries marked assetAvailable=true but the file is missing on disk:',
    );
    availableButMissingFile.forEach((entry) =>
      console.log(`  - ${entry.skuCode}  ->  public${entry.assetPath}`),
    );
  }

  console.log(`\nResult: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

main();
