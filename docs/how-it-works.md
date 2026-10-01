# How TriMet Collector works

This is a local-first browser game. There is no account and no server of your collection. You tap Play as if it were a Hop reader, prove you are on a vehicle, and open a pack. Cards and rides live in IndexedDB on that device.

## Surfaces

| Tab | Route | Job |
|---|---|---|
| Ride | `/` | Start screen, check-in, pack reveal |
| Album | `/collection` | Owned cards, grouped by mode |
| Log | `/log` | Unique-line coverage vs the GTFS catalog |
| Card | `/card/:id` | One owned card, large |

`/ride` still redirects to `/` so old links work. Home stays mounted when you leave Ride so GPS, the confirm overlay, and a pack in progress do not reset.

Portrait only: landscape shows “turn your phone upright.”

## Start (Hop parody)

Play opens a FastPass-style reader. After Play, the app pretends the fare is valid for about two hours, animates into the blue play session, then drops the start chrome. Theme color switches from near-black to TriMet blue. Web Audio is primed here so pack sounds can play later.

## Check-in (ride-only)

There is no station picker and no manual log. The only path is: I am on a vehicle.

1. **I’m on TriMet** opens the line picker. GPS watch and vehicle polling start only while that picker or the confirm overlay is open (`transitLive`).
2. Vehicles come from two sources, merged client-side: TriMet `/ws/v2/vehicles` through `/api/trimet` (MAX, bus, WES), and Portland Streetcar Umo IQ `vehicleLocations` through `/api/streetcar` (routes 193/194/195, shown as NS / A / B). The client never receives `TRIMET_APP_ID` (no `VITE_` prefix). Dev/preview Vite middleware and the Netlify functions inject the TriMet key server-side. Streetcar is a public feed; the proxy is only there to dodge CORS.
3. In-service vehicles within **250 m** of you are kept. The picker lists one best vehicle per route within **80 m** (A).
4. MAX is shown as MAX + color, not GTFS ids (90/100/190/200/290). Streetcar is NS / A / B, not 193/194/195.
5. Pick a line. Cooldown is **60 minutes** per `onboard|{routeNumber}`.
6. Confirm retries until **all** of: vehicle moved **≥ 80 m** (B), you moved **≥ 80 m** (C), you are within **40 m** of the last vehicle ping (D). A is only the initial pick. A miss does not burn the ride; Cancel bails out.
7. Overlay copy is wait/match with a pulse, not a distance bar — vehicle pings are too jumpy to show as a tracker.

Polling is 6 s in the picker and 3 s during confirm. GPS watch stays live while confirm is open.

## Packs

A pack is **1–3** cards. Each card is a weighted roll: common 60, uncommon 28, rare 10, legendary 2. If `unlockBias` matches the ride mode (bus / max / wes / streetcar), that card’s weight is ×1.8.

Reveal: fanfare, then a rarity sting as each card snaps. Drag the top card off the stack to dismiss. Lighting and tilt live on the pack overlay only.

After reveal, the last five receipts show on the Ride hub.

## Cards and art

Catalog: `src/data/cards.json`. Types: vehicle, route, station, operator. Album sections come from `unlockBias` (bus, train = MAX/WES, streetcar, else special).

Each card has `art` (emoji chrome) and `image` (path under `/art/{id}.webp`). The tile uses the WebP as the **entire face** only when that file exists and is listed in `src/lib/cardArt.ts`. Everyone else keeps the built layout (rarity, name, emoji, flavor).

## Album, detail, log

Album lists **owned** cards only, with copy counts. Detail is gated on inventory and shows first-unlock date.

Log is a **compendium**, not a ride history: how many unique catalog lines you have ridden in MAX, WES, Streetcar, and Buses (`src/data/routeCatalog.json`). Debug tools sit under that unless `?debug=0`.

## Persistence

IndexedDB `trimet-tcg` v2:

- `rides` — check-ins (cooldown + log)
- `inventory` — unique cards and counts
- `receipts` — each pack pull (Ride hub recents)

Reset (debug) clears those stores and the in-tab TriMet query counter.

## Debug and sims

On by default on Log (`debug` query ≠ `0`):

- `?hud=1` — live check-in A/B/C/D meters on a real ride (Log → Live check-in HUD, then Ride as usual)
- `?sim=checkin` — skips Hop, opens confirm with live A/B/C/D meters (you ride with the vehicle; should pack)
- `?sim=checkin-miss` — same HUD, GPS stays put (C never passes; Cancel)
- `?sim=ride-ok` — GPS follows a fake MAX; 80 m confirm should pass (manual pick)
- `?sim=ride-miss` — vehicle moves, GPS stays; confirm keeps matching until you Cancel
- `?sim=max-all` — five MAX companions
- `?sim=downtown` — parked at Pioneer Square
- `?pack=preview` — skip the ride, open a five-card stack (2 common, 1 uncommon, 1 rare, 1 legendary)

Sims do not call TriMet. Tabs keep the query string so a sim survives Album/Log.

## PWA

`vite-plugin-pwa`, auto-update. `/api/trimet` and `/api/streetcar` are NetworkOnly so vehicle data is never served stale from the service worker.
