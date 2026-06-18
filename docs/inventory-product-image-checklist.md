# Inventory Product-Image Acquisition Checklist

Tracks the **35 pending** real product photographs still required for full Inventory
coverage. The catalog wiring (manifest, resolver, UI, validation) is already complete; only the
binary assets are outstanding.

This is internal/operational metadata. It is **never** shown in the Inventory UI.

## Status legend

- `Pending real licensed photo` — no asset on disk yet (current state for all 35 below).
- `Done` — file exists locally at the exact path **and** its reuse rights are documented in
  `apps/web/src/features/inventory/data/productImageManifest.json` (`source` + `licenseNote`),
  and that entry's `assetAvailable` is flipped to `true`.

## Global rules for every asset below

- **Required file format:** WebP (consistent aspect ratio, product fully visible, neutral/light
  background, reasonable compression, no watermark, no retailer text).
- **Match type:** `representative-product-family` (the SKU/name does **not** identify a specific
  manufacturer/model; do **not** present a generic unit as a branded JUNG / HDL / CRESTRON / LUTRON
  product without evidence).
- **Source:** Pending acquisition — must be a real product photograph from an approved/own asset,
  an official manufacturer media asset with reuse permission, or a clearly permissively-licensed
  real photo. No category heroes, icons, illustrations, AI renders, generic boxes, or hotlinks.
- **License/reuse confirmation:** Not yet documented. Do **not** add a file unless its reuse rights
  are documented in the manifest.
- **Storage location:** under `apps/web/public/inventory-products/<category>/` (NOT the ignored
  `apps/api/.../wwwroot/uploads/inventory/` runtime folder).

> The single already-complete asset — `HDL-M/DLP04.1-A2-46` (exact-model, user/company-provided
> JPEG at `apps/web/public/inventory-products/smart-electrical/hdl-m-dlp04-1-a2-46.jpg`) — is **not**
> in this list; it is already present and documented.

---

## חשמל חכם (smart-electrical)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `ELE-UPS-1500` | אל-פסק UPS 1500VA | Line-interactive tower UPS, ~1500VA | `public/inventory-products/smart-electrical/ele-ups-1500.webp` | Pending real licensed photo |
| `SH-DIMMER-KNX` | יחידת עמעום חכמה KNX | Generic KNX DIN-rail dimming actuator | `public/inventory-products/smart-electrical/sh-dimmer-knx.webp` | Pending real licensed photo |
| `SH-RELAY-8CH` | מודול ממסרים חכם 8 ערוצים | Generic 8-channel DIN-rail relay actuator | `public/inventory-products/smart-electrical/sh-relay-8ch.webp` | Pending real licensed photo |
| `ELE-PSU-12V10A` | ספק כוח מיוצב 12V 10A | 12V 10A regulated switching PSU | `public/inventory-products/smart-electrical/ele-psu-12v10a.webp` | Pending real licensed photo |

## טלפוניה ואינטרקום (telephony-intercom)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `TEL-PHONE-IP` | טלפון IP שולחני | Desktop SIP/IP business telephone | `public/inventory-products/telephony-intercom/tel-phone-ip.webp` | Pending real licensed photo |
| `TEL-PBX-IP` | מרכזיית IP-PBX | IP-PBX appliance / rack PBX unit | `public/inventory-products/telephony-intercom/tel-pbx-ip.webp` | Pending real licensed photo |
| `INT-PANEL-IP` | פאנל אינטרקום IP בכניסה | Outdoor IP video door station | `public/inventory-products/telephony-intercom/int-panel-ip.webp` | Pending real licensed photo |
| `INT-STATION` | שלוחת אינטרקום פנים | Indoor intercom station / monitor | `public/inventory-products/telephony-intercom/int-station.webp` | Pending real licensed photo |

## כבילה ותשתיות (cabling-infrastructure)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `NET-PATCHCORD2` | כבל חיבור רשת 2 מ׳ | Short RJ45 Ethernet patch cord (~2 m) | `public/inventory-products/cabling-infrastructure/net-patchcord2.webp` | Pending real licensed photo |
| `NET-FIBER-SM` | כבל סיב אופטי חד-מודי | Single-mode fiber cable / spool | `public/inventory-products/cabling-infrastructure/net-fiber-sm.webp` | Pending real licensed photo |
| `NET-CAT6-305` | כבל רשת CAT6, תיבה 305 מ׳ | CAT6 bulk-cable pull box (305 m) | `public/inventory-products/cabling-infrastructure/net-cat6-305.webp` | Pending real licensed photo |
| `ELE-CONDUIT-25` | צינור שרשורי 25 מ״מ | Corrugated flexible conduit coil (25 mm) | `public/inventory-products/cabling-infrastructure/ele-conduit-25.webp` | Pending real licensed photo |

## מולטימדיה (multimedia)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `AV-AMP-240` | מגבר כריזה ומולטימדיה 240W | 240W PA / multimedia rack amplifier | `public/inventory-products/multimedia/av-amp-240.webp` | Pending real licensed photo |
| `AV-MIC-CONF` | מיקרופון ועידה שולחני | Desktop boundary conference microphone | `public/inventory-products/multimedia/av-mic-conf.webp` | Pending real licensed photo |
| `AV-SCREEN-75` | מסך מקצועי 75 אינץ׳ | 75" professional commercial display | `public/inventory-products/multimedia/av-screen-75.webp` | Pending real licensed photo |
| `AV-PROJ-LASER` | מקרן לייזר 5000 לומן | Professional laser projector (~5000 lm) | `public/inventory-products/multimedia/av-proj-laser.webp` | Pending real licensed photo |
| `AV-SPK-CEIL6` | רמקול תקרה 6W | Flush-mounted ceiling speaker (6W) | `public/inventory-products/multimedia/av-spk-ceil6.webp` | Pending real licensed photo |

## מערכות אזעקה (alarm-systems)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `ALM-PIR` | גלאי נפח IR | Indoor PIR motion detector | `public/inventory-products/alarm-systems/alm-pir.webp` | Pending real licensed photo |
| `FIRE-SMOKE-DET` | גלאי עשן אופטי כתובתי | Addressable optical smoke detector | `public/inventory-products/alarm-systems/fire-smoke-det.webp` | Pending real licensed photo |
| `ALM-SIREN` | סירנה חיצונית עם פלאש | Outdoor alarm siren with strobe | `public/inventory-products/alarm-systems/alm-siren.webp` | Pending real licensed photo |
| `ALM-PANEL-8Z` | רכזת אזעקה 8 אזורים | 8-zone intrusion alarm control panel | `public/inventory-products/alarm-systems/alm-panel-8z.webp` | Pending real licensed photo |

## מצלמות אבטחה (security-cameras)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `HDD-8TB` | דיסק קשיח לאבטחה 8TB | Surveillance-grade 3.5" hard drive (8TB) | `public/inventory-products/security-cameras/hdd-8tb.webp` | Pending real licensed photo |
| `CAM-PTZ-2MP` | מצלמת PTZ ממונעת 2MP | Motorized PTZ dome camera (2MP) | `public/inventory-products/security-cameras/cam-ptz-2mp.webp` | Pending real licensed photo |
| `CAM-DOME-4MP` | מצלמת כיפה IP 4MP | Fixed dome IP camera (4MP) | `public/inventory-products/security-cameras/cam-dome-4mp.webp` | Pending real licensed photo |
| `CAM-BULLET-8MP` | מצלמת צינור IP 8MP | Bullet IP camera (8MP) | `public/inventory-products/security-cameras/cam-bullet-8mp.webp` | Pending real licensed photo |
| `NVR-16CH` | מקליט רשת NVR 16 ערוצים | 16-channel NVR appliance (distinct from 32CH) | `public/inventory-products/security-cameras/nvr-16ch.webp` | Pending real licensed photo |
| `NVR-32CH` | מקליט רשת NVR 32 ערוצים | 32-channel NVR appliance (distinct from 16CH) | `public/inventory-products/security-cameras/nvr-32ch.webp` | Pending real licensed photo |

## רשת מחשבים (networking)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `NET-RACK-42U` | ארון תקשורת 19 אינץ׳ 42U | Full-height 42U 19" network cabinet | `public/inventory-products/networking/net-rack-42u.webp` | Pending real licensed photo |
| `NET-SWITCH-P24` | מתג PoE מנוהל 24 פורט | Managed 24-port PoE switch (1U) | `public/inventory-products/networking/net-switch-p24.webp` | Pending real licensed photo |
| `NET-ROUTER-ENT` | נתב ארגוני | Enterprise router / security gateway | `public/inventory-products/networking/net-router-ent.webp` | Pending real licensed photo |
| `NET-PATCH-24` | פאנל ניתוק 24 פורט | 24-port RJ45 patch panel (1U) | `public/inventory-products/networking/net-patch-24.webp` | Pending real licensed photo |

## שו"ב (control-monitoring)

| SKU | שם פריט | Narrow product family | Expected asset path | Status |
|---|---|---|---|---|
| `BMS-CTRL-DDC` | בקר DDC לבקרת מבנה | DDC building-management controller | `public/inventory-products/control-monitoring/bms-ctrl-ddc.webp` | Pending real licensed photo |
| `ACS-CTRL-4DR` | בקר כניסה 4 דלתות | 4-door access-control board/enclosure | `public/inventory-products/control-monitoring/acs-ctrl-4dr.webp` | Pending real licensed photo |
| `ACS-MAGLOCK-600` | מנעול מגנטי 600 ק״ג | Electromagnetic door lock (600 kg) | `public/inventory-products/control-monitoring/acs-maglock-600.webp` | Pending real licensed photo |
| `ACS-READER-RFID` | קורא כרטיסים RFID | Wall-mounted RFID proximity reader | `public/inventory-products/control-monitoring/acs-reader-rfid.webp` | Pending real licensed photo |

---

## When adding an asset

1. Save the licensed WebP to the exact path above.
2. In `apps/web/src/features/inventory/data/productImageManifest.json`, set that SKU's
   `assetAvailable` to `true` and fill in accurate `source` and `licenseNote`.
3. If the photo is the verified exact model (with evidence), change its `matchType` to
   `exact-model`; otherwise keep `representative-product-family`.
4. Re-run validation (see below). Do not mark a SKU `Done` until its file exists locally and its
   reuse rights are documented.

## Validation commands

Run from the repo root.

```bash
# Standard manifest validation (mapping integrity; pending photos are allowed)
npm run validate:inventory-images --workspace=apps/web

# Strict final-asset validation (requires all 36/36 real assets present)
npm run validate:inventory-images:strict --workspace=apps/web
```

Current expected results: standard = **PASS** (36 mapped, 0 mapping problems); strict = **FAIL**
(1 present, 35 pending) until all 35 photos above are added.
