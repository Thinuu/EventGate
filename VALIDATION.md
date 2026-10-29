# Validation update — 28 October 2026

The previous database-startup blocker was resolved by disabling Unix sockets for disposable MongoDB test instances.

- 13 local regression tests passed, including production import without configured services.
- 3 MongoDB/HTTP integration suites passed: payment concurrency; RFID/shared-limit/expiry transactions; and HTTP readiness/login/reader/cron behavior.
- Backend syntax checks passed after the Vercel adaptation.
- Vite production frontend build passed; large-bundle warnings remain.
- Frontend npm audit reported zero findings after migration and dependency updates.
- Initial Vercel build reached the final deployment stage but was rejected because the team's Hobby plan disallows minute crons. The corrected deployment uses a daily fallback plus an included external scheduler configuration. Check Vercel's current deployment result before release.

Atlas, production secrets, storage, real email/payment/AI credentials, physical reader testing, external scheduler activation and go-live acceptance remain account-specific setup requirements. No claim is made that those have been completed. See VERCEL_SETUP.md.

The final backend target uses `backend/Dockerfile.vercel` (Node 24 container) to preserve the complete runtime dependency tree and HTTP/WebSocket server. Vercel Services and container runtime availability must be enabled on the target account. Build success alone does not prove API readiness.
