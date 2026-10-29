# 17_TESTING_GUIDE — Archived

This repository currently does not include runnable test suites (unit, integration, or E2E). The previous testing guide has been archived and references to automated test runs have been removed from documentation and CI workflows.

If you would like to add test coverage, recommended next steps:

- Create a `backend/tests/` directory and add Jest + Supertest based suites for API routes.
- Add `frontend/src/__tests__/` with React Testing Library tests for key components.
- Use `mongodb-memory-server` for isolated backend tests and `npx cypress` for E2E when needed.
- Update CI workflows to install dev dependencies and run the chosen test commands.

If you want, I can scaffold minimal backend and frontend test configs and add CI steps — tell me whether to proceed.
