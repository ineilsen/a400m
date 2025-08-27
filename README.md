# A400 Webapp (A400M interactive viewer)

=====================================

Short description

-----------------

This repository contains a single-page interactive 3D viewer for the A400M aircraft with gesture control, AI chat integration (proxied via a Node/Express server), flight/health data stored under `data/`, and simple file-based logging under `data/logs/`.

Quick start

-----------

1.  Install dependencies

    ```bash
    npm install
    ```

2.  Add environment variables

    Create a `.env` file in the project root or set environment variables in your shell. Minimal variables used by the server:

    - AZURE\_OPENAI\_ENDPOINT - (optional) Azure OpenAI endpoint, e.g. https://your-resource.openai.azure.com
    - AZURE\_OPENAI\_KEY - (optional) Azure OpenAI key
    - AZURE\_OPENAI\_DEPLOYMENT - (optional) Azure OpenAI deployment name used to call Chat Completions
    - PORT - (optional) port for the Node server (defaults to 3000)

    Example `.env` (do not commit secrets):

    ```bash
    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
    AZURE_OPENAI_KEY=your_api_key_here
    AZURE_OPENAI_DEPLOYMENT=deployment-name
    PORT=3000
    ```

3.  Run the server

    ```bash
    npm start         # production mode
    npm run dev       # nodemon watch during development
    ```

    Open http://localhost:3000 in your browser.

Project layout

--------------

- `public/` - client SPA and static assets (three.js scene, textures, GLTF scene)
- `server.js` - Express server entrypoint
- `server/` - server helpers and route modules
  - `server/config.js` - central configuration
  - `server/prompts.json` - system/user prompts used by AI route
  - `server/routes/ai.js` - AI proxy and deterministic summary handler
  - `server/routes/neurosan_client.js` - (project specific route)
- `data/` - authoritative application data
  - `flights.json` - master flights list (20 flights)
  - `flights/*.json` - per-flight saved files
  - `logs/` - JSON-lines logs produced by server (e.g., `ai.log`, `gesture.log`)
- `test/` - unit & integration tests (Mocha)

Features and behavior

---------------------

- 3D Viewer: uses three.js, OrbitControls and a GLTF scene. Aircraft model scale has been increased for better visibility.
- Gesture control: MediaPipe-based gestures to hover/select and manipulate the model.
- Camera controls: an on-screen slider controls zoom/distance (slider is authoritative when `SLIDER_ONLY_CAMERA` is enabled); mouse and gestures can still rotate the model on the X-axis.
- Flight data: component marker information and flight health are read from `data/flights.json` and per-flight files.
- AI chat: UI widget in the client posts to `/api/ai-chat`. The server runs a tiny deterministic classifier and will short-circuit to a local deterministic reply for squadron/flight summary queries (no call to Azure) when confidence is high. Otherwise it augments the system prompt with a local summary and proxies the request to Azure OpenAI.
- Logs: AI events are appended as JSON-lines to `data/logs/ai.log`; gesture sampling (Test Mode) posts to `/api/gesture-log` and is stored in `data/logs/gesture.log`.

Available API endpoints

-----------------------

All endpoints are served by the Node server (default port 3000).

- GET /api/flights
    - Returns the flights index (`data/flights.json`).

- GET /api/flights/:id
    - Returns a single flight details (from `data/flights/<id>.json` or looked up in master file).

- PUT /api/flights/:id
    - Persists per-flight data updates (accepts JSON payload and writes to `data/flights/<id>.json`).

- GET /api/squadron-summary
    - Returns a deterministic server-side computed squadron summary (aggregates totals and worst-case component statuses across flights).

- POST /api/gesture-log
    - Accepts 1Hz sampled gesture telemetry when Test Mode is enabled in the client; server appends to `data/logs/gesture.log`.

- POST /api/ai-chat
    - AI chat endpoint. Server runs an intent classifier and either replies locally (for high-confidence summary intents) or forwards to Azure OpenAI with injected local summaries. Events are logged to `data/logs/ai.log`.

Development notes and architecture

----------------------------------

- Deterministic fallback: to improve reliability and avoid unnecessary LLM calls, the server includes a small classifier and deterministic summary generators (`computeSquadron` / `computeFlightSummary`). When the classifier returns a summary intent with confidence >= 0.7 the server will reply locally.
- Prompts: `server/prompts.json` contains the system prompts used by the AI route. Modify prompts there; do not commit secrets.
- Config: central config is wired through `server/config.js` which reads from environment variables.

Testing

-------

Run unit tests with Mocha:

```bash
npm test
```

Troubleshooting

---------------

- Missing dependencies when running `npm start`:
    - Run `npm install` and try again.

- Azure OpenAI errors like "The API deployment for this resource does not exist":
    - Verify `AZURE_OPENAI_DEPLOYMENT` matches the deployed model name in the Azure portal. Confirm `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_KEY` are correct.
    - Check server console output for proxied error details (server forwards Azure error responses into `ai.log`).

- Git push rejected (non-fast-forward):
    - This happens when the remote contains commits you don't have locally. Safe sequence:

    ```bash
    # 1) Save local changes if you have uncommitted work
    git add -A
    git commit -m "WIP: save local work"   # or 'git stash'

    # 2) Integrate remote changes (rebase keeps a linear history)
    git fetch origin
    git pull --rebase origin main

    # 3) Resolve any conflicts, then continue rebase
    # git rebase --continue

    # 4) Push
    git push -u origin main
    ```

    I can also perform the safe stash/pull/rebase/push sequence for you if you want — tell me whether to auto-commit the current changes or stash them.

Security and secrets

--------------------

- Never commit `.env` or other secrets. Add them to `.gitignore`.
- Before pushing to a remote, double-check you are not committing API keys or private data.

Contributing

------------

- Open issues for bugs and feature requests.
- Make feature branches from `main` and open pull requests with a clear description and tests where applicable.

License

-------

MIT

Contact / support