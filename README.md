# TriMet TCG

Browser app for logging specific Portland-area TriMet buses and trains. Each check-in opens a random pack of collectible cards. Data stays on this device (IndexedDB).

## Run

1. Copy `.env.example` to `.env`.
2. Optional: get a free `appID` at [developer.trimet.org](https://developer.trimet.org/) and set `TRIMET_APP_ID` in `.env` (server-only; do not use a `VITE_` prefix). Without a key, nearby vehicles fall back to demo data.
3. `npm install` then `npm run dev`.
4. Open the Ride screen. Allow location, or add `?sim=downtown` to the URL to fake GPS in Portland.

GPS lists nearby vehicles. Manual log is always on the same screen (search a live route, or type route + vehicle ID if the feed is down).
