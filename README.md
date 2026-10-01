# TriMet TCG

Browser app for logging specific Portland-area TriMet buses and trains. Each check-in opens a random pack of collectible cards. Data stays on this device (IndexedDB).

How the product behaves: [docs/how-it-works.md](docs/how-it-works.md).

## Run

1. Copy `.env.example` to `.env`. (you need a trimet app id to run this. This is handled server side in my case but if you want to run it locally just put it in the env)
2. `npm install` then `npm run dev`.
