# ENTRYNEX hardened release candidate

This package is an implemented hardening and hardware-extension pass, not a certification that every legacy workflow is production ready. Do not deploy it over live data without a backup, staging migration and the checks below.

## What changed

- API and Socket.IO authentication require access-purpose JWTs. Refresh and temporary-password JWTs cannot authorize ordinary API calls. All users must sign in again after upgrading.
- Device approval configuration now requires a device header rather than allowing clients to omit it.
- User JSON strips refresh tokens and MFA secrets/backup codes, including after login explicitly selected those fields.
- Stripe callbacks preserve raw bytes for signature validation; PayHere form bodies parse correctly. PayHere order/event/currency are checked against the callback. Stripe completion checks paid state, amount, stored session ID and event.
- Successful card payment state, revenue and a durable fulfillment task commit in one MongoDB transaction. Concurrent callbacks cannot intentionally double-credit revenue. Failed and pending callbacks use guarded updates; paid orders cannot be downgraded by these callbacks.
- Fulfillment tasks retry with backoff. Inspect `paymenttasks` for `failed` or stale `processing` tasks. Notification delivery is at least once: provider-level idempotency and operator reconciliation remain necessary after ambiguous failures.
- RFID assignment/release service operations now use transactions and existing unique active-assignment indexes. Legacy attendee and sub-organiser assignment endpoints route through this service. Replacement is explicit unassign followed by assign.
- Disabled physical tags cannot enter through the shared RFID validation flow.
- Reader profiles normalize keyboard, serial bridge, network bridge and NFC bridge inputs. Existing UI inputs accept 1–64 letters/digits/underscores/hyphens, retaining leading zeros.
- `/admin/hardware` registers/enables/disables readers, previews identifiers and generates optional AI summaries. Inventory links to this page.
- Optional AI receives only operation counts, has a request timeout and per-user-route rate limiting, and does not decide access, photo identity, payment approval or fraud.
- Replaced the unpatched `xlsx` package with an ExcelJS compatibility layer, preserving tabular XLSX/CSV workflows. Legacy binary XLS and formula-cell uploads are rejected. Exported formula-like text is escaped. CSV identifiers retain leading zeros. RFID cells in XLSX must be stored as text.
- Fixed duplicate `canScanZones` declaration, added missing backend dependencies, upgraded Multer/Nodemailer/Sharp, pinned a compatible otplib API, updated compatible transitive dependencies, added syntax/regression checks and database integration test.
- Restricted generic attendee editing to organiser roles and contact/note fields. Use dedicated endpoints for verification, payment and RFID changes.
- Added liveness/readiness probes, shutdown handling, MongoDB startup failure handling, minimum production JWT-secret strength and container definitions. Demo seed/clear scripts refuse production operation.

## Start locally

Use Node.js 22 or 24 and a MongoDB replica set (Atlas also works). Standalone MongoDB cannot execute the new transactions.

```bash
cd backend
cp .env.example .env
# Configure your replica-set MONGODB_URI or MONGO_URI and a strong JWT_SECRET.
npm ci
npm test
npm run check
npm start
```

In another terminal:

```bash
cd frontend
npm ci
npm start
```

For production build `npm run build` in frontend. Build `REACT_APP_API_URL` with the full HTTPS API origin and `/api` suffix. This is a build-time setting. CORS_ORIGINS must contain exact frontend origins, without paths or trailing slashes. Use same-site HTTPS frontend/API domains so refresh cookies work under SameSite=Lax. Do not use the demo seeder to create a production admin.

## Hardware compatibility contract

A reader must produce a stable textual tag identifier. The backend does not drive antenna power, read ranges, proprietary SDKs, binary protocols or access relays.

| Reader | Supported route | Requirements |
|---|---|---|
| USB HID / keyboard wedge | Existing RFID input fields | Printable ID followed by Enter; configure the reader's output to match stored identifiers |
| Serial / USB COM | `tools/reader_bridge.py --port COM3 --action check_in` | Install pyserial; configure baud rate; ASCII line-delimited protocol |
| TCP/IP or vendor SDK | Vendor bridge to authenticated scan API | Integrate vendor SDK locally and send one normalized scan per intentional operation |
| NFC | NFC bridge to scan API | Browser/OS NFC support or vendor middleware required; raw UID output must match inventory |
| UHF EPC | Hex profile through supported bridge | Explicitly select which tag to scan; RF reads of multiple nearby tags must be filtered by the bridge |

Profiles: numeric10, decimal (up to 64 digits), hex (2–32 bytes, strips `:`, spaces and hyphens and uses uppercase), alphanumeric. Prefix/suffix are literal strings. Register hex inventory in the exact canonical uppercase form produced by preview. Numeric-to-hex conversion, byte-order changes and vendor namespaces are deliberately not guessed. The global unique identifier index remains: duplicate IDs from separate vendors need an explicit namespace/migration before use.

POST `/api/readers` as an admin/event organiser with:

```json
{"eventId":"EVENT_ID","name":"Gate A serial","transport":"serial-bridge","format":"hex","prefix":"UID:","suffix":"","gateName":"Gate A"}
```

An authenticated staff/organiser client then POSTs `/api/entry/scan`:

```json
{"readerId":"READER_ID","eventId":"EVENT_ID","scan":"UID:AA:BB:00:11","action":"check_in","gateId":"Gate A"}
```

Or POST `/api/zone/scan` with the same data plus `zone`. The current zone route determines entry/exit from state; it must not be retried blindly. Reader registration never grants authority: existing role, event, gate, ticket and zone checks still apply. A disabled reader is rejected when its profile is used. Legacy manual/keyboard scans remain available to authorized operators; disabling a profile is not credential revocation.

Bridge environment: `EAMS_URL` (server origin), `EAMS_TOKEN` (operator access token), `EAMS_READER_ID`, `EAMS_EVENT_ID`, and `EAMS_DEVICE_ID` when device approval is enabled. The bridge reads stdin if `--port` is omitted. It stops on authorization failure; it does not store passwords, auto-login, retry ambiguous mutations, or queue offline entry grants. Proprietary SDKs, MQTT and binary TCP readers require an adapter. No actual physical reader has been tested in this environment.

## AI configuration

Set `AI_ENABLED=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL` to a model available to your account. Restart the backend. Use `/admin/hardware` or POST `/api/ai/event-summary` with `eventId` as an event organiser/admin. Outbound HTTPS to api.openai.com and a funded API account are required. AI defaults to disabled and has not been called with live credentials here. Key never goes to the browser; request uses `store:false` and sends aggregate counts only.

## Migration and go-live requirements

1. Back up the database and restore it to staging. Reconcile any legacy RFID snapshots using the supplied existing `scripts/sync_legacy_data.js`; review that script and its output first. Check physical-tag uniqueness and active assignment uniqueness before building indexes. Inspect imported identifiers for numeric rounding/case collisions.
2. Use a replica set and explicitly build the required indexes in staging, including `RfidAssignment`, `Reader`, `Order`, and `PaymentTask`. Exercise transaction rollback and simultaneous assignment/payment callbacks. Confirm the integration test below passes on your database/runtime.
3. Configure fresh real secrets, exact CORS origins, public HTTPS URLs, storage containers and messaging providers. Rotate any actual credential formerly committed in source. Existing tokens must be replaced by a fresh login. Do not expose secrets or `.env` in a web root.
4. Complete end-to-end checks for registration, MFA and device approval; ordering and capacity contention; Stripe and PayHere sandbox success/failure/replay; bank approval and cash collection; attendee invitation/photo verification; QR/RFID entry/exit; zone occupancy; and reports/import/export.
5. Test each physical reader with leading zeros, byte-order/encoding settings, Enter framing, duplicate scans, multiple tags, loss of network, reader disable, tag disable and revoked operators. This build is not an offline access-control system.
6. Place behind trusted TLS ingress. Set TRUST_PROXY_HOPS only to your actual trusted proxy depth. In-memory limits and Socket.IO require a shared rate-limit store and adapter before scaling to multiple instances. Existing schedulers also need a deployment-level single-worker policy; the new payment-task worker uses database claims.
7. Add backups, restore drills, monitoring for payment-task failures, provider errors, stale reservations and rejected scans. Readiness is `/health/ready`; liveness is `/health/live`. Test container builds and termination in your target environment.
8. Re-run dependency audits and resolve/accept remaining findings with ownership. Frontend still uses legacy Create React App and a large bundle; migrate its toolchain separately before treating dependency maintenance as complete.

Known boundaries: this pass did not exhaustively rewrite all legacy routes/controllers, add a mobile app, implement arbitrary vendor SDKs, establish PCI compliance, load-test event capacity, verify live AI/provider delivery, or deploy infrastructure. Cash/bank approval and old schedulers retain legacy implementations and require staging tests. Chargebacks on already-paid orders are acknowledged without automatic reversal and require payment reconciliation. Fulfillment is eventually consistent; provider receipts must be monitored. Imported XLSX files still need resource isolation for hostile-file environments. No production readiness claim should be based on build success alone.

## Verification commands

```bash
cd backend
npm ci
npm test
npm run check
npm run test:integration
npm audit --omit=dev
```

The integration suite starts a temporary replica set by default. For a pre-provisioned **disposable test database only**, set TEST_MONGO_URI to its replica-set connection string; the test inserts fixtures. Never point tests at production. Frontend: `npm ci && npm run build`. CI includes the database test as a separate job.
