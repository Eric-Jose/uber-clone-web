# PreçoFixo17 — realtime rides on Vercel

The production architecture uses the backend embedded in this repository (`backend/`) through the Vercel `/api` function. Socket.IO is not initialized in the Vercel serverless entrypoint, so ride synchronization must not depend on a persistent Socket.IO connection. Firebase Realtime Database remains the source of truth for ride state and Firebase transactions enforce single-driver acceptance.

## Required client behavior
- Create/search/cancel/accept rides through `/api/rides`.
- Treat Firebase/HTTP ride state as authoritative.
- Refresh active ride state on a short interval while a ride is SEARCHING/ACCEPTED/IN_PROGRESS.
- Stop displaying SEARCHING rides immediately when status is no longer SEARCHING.
- Never allow a client-side notification/cache to override a ride that has become ACCEPTED or CANCELLED.

This note documents the production constraint before the realtime client hardening is applied.
