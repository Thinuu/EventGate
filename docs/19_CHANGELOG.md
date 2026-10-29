# 19_CHANGELOG

## Changelog

All notable changes to the **ENTRYNEX / EAMS** project documentation are listed in this file.

### 2026-09-29
- **V26: RFID implementation updates**:
  - Implemented backend RFID tag schema (`RfidTag.js`) for dedicated tracking.
  - Upgraded `Attendee` schema with a sparse compound unique index (`{ event: 1, rfidTag: 1 }`) for robust RFID deduplication.
  - Modernized `docs/04_DATABASE_DOCUMENTATION.md` and `docs/06_DATABASE_RELATIONSHIPS.md` to document the new `rfidtags` collection and updated schema relationships.
  - Corrected `docs/11_ZONE_ACCESS_CONTROL.md` to remove outdated static access fields like `currentZone`, accurately reflecting dynamic logging through `EntryLog` and `ZoneLog`.

### 2026-07-30
- Added comprehensive documentation files covering the entire system:
  - `12_NOTIFICATION_SYSTEM.md`
  - `13_SECURITY_DOCUMENTATION.md`
  - `14_ERROR_HANDLING_LOGGING.md`
  - `15_ENVIRONMENT_CONFIGURATION.md`
  - `16_DEPLOYMENT_GUIDE.md`
  - `17_OPERATIONS_GUIDE.md`
  - `18_TROUBLESHOOTING.md`
  - `19_CHANGELOG.md`
- Updated `README.md` with a documentation index linking to all new markdown files.
- Fixed ticket assignment UI for **SOLD** tickets in `frontend/src/pages/buyer/BuyerOrderDetailsPage.jsx`.
- Performed project cleanup by removing obsolete scripts, logs, and test artifacts.

### 2026-07-28
- Created initial documentation set (files 01‑11) covering project overview, architecture, structure, database, API, authentication, roles, business logic, payment flows, and zone access control.
- Added `docs/` directory and updated root `README.md` to reference the new docs.
- Cleaned up legacy files and directories as per user request.

### 2026-07-27
- Initial repository import and base project setup.

### 2026-09-16
- **Entry/Zone Scanning Enhancements**:
  - Added proper check-in/check-out state management for entry scanner
  - Implemented credential deduplication (QR check-in → RFID check-out allowed, and vice versa)
  - Added "Switch to Exit Mode" button when check-in is denied for already checked-in attendees
  - Zone scanner now requires main entry check-in before allowing zone entry
  - Zone scanner auto-toggles between ENTRY and EXIT based on current zone state
- **SubOrganizer Dashboard**:
  - Added operational section with Entry Scanning, Zone Scanning, and Manual Search cards
  - Added real-time operation statistics (Entry In/Out, Zone In/Out, QR/RFID scans, Denied)
  - Added Recent Scans activity feed with attendee details
- **RFID Assignment Workflow**:
  - Added "RFID Not Assigned" prompt after successful scan for attendees without RFID
  - RFID assignment only available when `event.settings.rfidEnabled === true`
  - Backend rejects RFID operations for disabled events with 403 `RFID_DISABLED`
  - Updated Staff Scan Page and SubOrg Entry Scanner with RFID assignment support
- **Documentation Updates**:
  - Updated `README.md` with new scanning and RFID assignment sections
  - Updated `09_BUSINESS_LOGIC.md` with check-in/check-out flow and SubOrganizer operations
  - Rewrote `11_ZONE_ACCESS_CONTROL.md` with comprehensive entry/zone scanning documentation

### 2026-09-29
- **QR Scanner `play()` AbortError Fix**:
  - Added a global `HTMLMediaElement.prototype.play` wrapper in `frontend/src/index.js` to silently swallow `AbortError` exceptions caused by React 18 StrictMode double-mounting and component unmount race conditions with the HTML5-QRCode camera stream.
  - Added a global `unhandledrejection` listener to prevent the same error from surfacing as an uncaught runtime error overlay in development.
  - Hardened `QRScannerComponent.jsx` cleanup logic: the effect's return function now calls `.catch().finally()` on the `startPromise` so the camera is always gracefully stopped and cleared even when unmounting occurs during camera initialization.
- **Sub-Organiser Zone Scanner — Synced with Staff Dashboard Logic**:
  - Rewrote `SubOrgZoneScannerPage.jsx` to be functionally identical to `StaffZoneAccessPage.jsx`:
    - Same 4-tab layout (Scanner, Manual, Stats, Logs).
    - Offline mode with automatic re-sync queue (`entrynex:offline-zone-scans`).
    - Socket.IO listeners for both `zone_update` and `zone_scan` events for real-time metric and log updates matching the staff dashboard.
    - `availableZones` computed from the current event's zone list, with zone dropdown shown when not locked to assigned zones.
    - `getZoneDisplayName` helper for human-readable zone labels.
    - `lastScan` card, paginated log view, stats metrics, RFID reader mode toggle (shown only when `event.settings.rfidEnabled === true`).
- **Removed RFID Assignment Widget from Zone Scanner**:
  - Removed the "Assign RFID Tag" panel (10-digit entry field and Assign button) from `SubOrgZoneScannerPage.jsx`.
  - Zone terminals are now exclusively high-throughput scan terminals; RFID pairing remains on the dedicated `/suborg/rfid-assignment` page.
- **Documentation Updates**:
  - Updated `11_ZONE_ACCESS_CONTROL.md` to accurately reflect that both Staff and Sub-Organiser zone terminals are now feature-identical (Scanner, Manual, Stats, Logs tabs) with no RFID assignment widget on the zone page.
  - Updated `19_CHANGELOG.md` with this entry.

### 2026-08-31
- Fixed undefined `conference` error in `EventDetailPage.jsx` by adding missing variable definitions for `match`, `concert`, `conference`, and `workshop` extracted from the event object.

### 2026-08-05
- Updated error handling and logging documentation (see `14_ERROR_HANDLING_LOGGING.md`).

---
*This changelog reflects documentation and minor code updates performed throughout the project lifecycle. For full code change history, refer to the Git commit log.*
