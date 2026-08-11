# NexGrid

A block-stacking puzzle game shipped as a Windows desktop app, with online
leaderboards and server-verified scores.

## Download

Installers are published on the [Releases page](https://github.com/ivanpirgozliev/NexGrid/releases).
The app updates itself from there.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Desktop shell | Electron + electron-builder |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Routing | React Router 7 |
| State (server) | TanStack React Query 5 |
| State (game) | `useReducer` (pure reducer) |
| API | Cloudflare Workers + Hono |
| Database | Neon (serverless Postgres) |
| Auth | Own JWT issuance, bcrypt via pgcrypto |
| Object storage | Cloudflare R2 (avatars) |

---

## Architecture

```
src/
  features/
    auth/             # Login, register, auth context + hooks
    tetris/           # Game logic, rendering, score submission
      hooks/          # useTetris (reducer), useGameLoop, useSaveScore
      utils/          # board.ts, tetrominos.ts, scoring.ts
      components/     # Board, Cell, NextPiece, GameOverlay, Controls, LineClearEffect
      types/          # TetrominoType, Board, GameState, etc.
    leaderboard/      # Top-100 leaderboard with live data
    profile/          # Player stats dashboard
  components/ui/      # Shared Button, Input
  services/           # scores.service.ts, auth.service.ts
  lib/                # api client, auth store, react-query client
  layouts/            # AppLayout + Navbar

worker/               # Cloudflare Worker - the only thing that touches the DB
  migrations/         # SQL migrations, applied by scripts/apply-migrations.mjs
  src/
    routes/           # auth, game, data, avatar
    middleware/       # bearer-token auth, CORS allowlist
    lib/              # JWT, validation, score bounds
```

### Data Flow

The client never reaches the database. Every read and write goes through the
Worker, which is the only holder of the connection string.

1. Player signs in -> the Worker verifies the password with `crypt()` in
   Postgres and returns an access token (1 h) plus a rotating refresh token
   (30 d). Both are kept in `localStorage`.
2. Player clicks "Play" -> `POST /game/start` creates a `game_sessions` row with
   a server-generated token.
3. During gameplay the client sends a heartbeat every 15 s to
   `POST /game/heartbeat`.
4. On game-over `POST /game/submit-score` runs the anti-cheat checks and inserts
   the row.
5. Leaderboard, stats and profile come from `GET` routes, cached by React Query.
6. Expired access tokens are refreshed transparently by the API client, which
   shares one in-flight refresh across concurrent requests — refresh tokens are
   single-use, so parallel refreshes would invalidate each other.

### Security Model

Authorization lives in the Worker: the user id comes from the token, and no
route accepts a caller-supplied id. Postgres keeps the guarantees that must hold
regardless of application bugs.

- **No client-reachable database.** The connection string exists only as a
  Worker secret.
- **Passwords** are bcrypt (cost 10) via pgcrypto. Unknown-email and
  wrong-password responses are indistinguishable in both content and timing.
- **Login throttling** — 10 failures locks the account for 15 minutes.
- **Refresh tokens** are stored as SHA-256 digests and are single-use.
- **CORS allowlist** for browser origins; the packaged desktop app sends no
  `Origin`, which is safe here because auth is a bearer token, never a cookie.
- **Avatar uploads** are capped at 2 MB, limited to JPEG/PNG/WebP, and the
  declared type is verified against the file's magic bytes.
- **Anti-cheat pipeline** in `submit-score`:
  - Session token must match.
  - Session must be at least 10 s old.
  - Session must not exceed max lifetime (2 h).
  - Minimum play time scales with lines cleared (1.5 s per line).
  - Score must fall within `[computeMinScore, computeMaxScore]` for the given lines.
  - Level must be consistent with `floor(lines / 10) + 1`.
  - At least 50 % of expected heartbeats must have been received.
  - Last heartbeat timestamp must be fresh.
  - Session is atomically claimed before insert (replay-resistant).
  - Rate-limited to one score every 5 s.
  - All durations are computed by Postgres from its own timestamps, so no check
    depends on the client's clock.
- **DB integrity checks**:
  - `CHECK` constraints bound score, level and lines.
  - `scores.session_id` is unique (one score per session).
  - Trigger validates `session_id -> user_id` ownership and completed session state.

See [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md) for the full threat model.

---

## Screenshots

> Replace these placeholders with actual screenshots or GIFs.

| Gameplay | Leaderboard | Profile |
|---|---|---|
| ![Gameplay](docs/gameplay.png) | ![Leaderboard](docs/leaderboard.png) | ![Profile](docs/profile.png) |

---

## Game Loop

The game loop lives in two hooks:

### `useGameLoop` (`src/features/tetris/hooks/useGameLoop.ts`)

A thin wrapper around `setInterval`. It takes a callback, an interval in ms, and an `active` flag. The callback is stored in a ref so the interval never re-subscribes when the callback's identity changes -- only `intervalMs` or `active` trigger a new interval. This means the tick function always calls the latest version of the reducer dispatch without stale closures.

### `useTetris` (`src/features/tetris/hooks/useTetris.ts`)

All game state lives in a single `useReducer`. The reducer is a **pure function** -- no side effects, no refs, no async. Every user action (move, rotate, drop) and every tick maps to a deterministic state transition.

The tick interval is derived from the current level: `max(80, 1000 - (level - 1) * 90)` ms. At level 1 the piece drops once per second; by level 11 it drops every 80 ms.

**Line-clear animation** is handled via a two-phase state machine:
1. When full rows are detected, the reducer enters `status: 'clearing'` and records `clearedRows`.
2. A `useEffect` watches for `'clearing'` status and sets a 400 ms timeout before dispatching `FINISH_CLEAR`.
3. `FINISH_CLEAR` removes the rows, updates score/level/lines, and spawns the next piece.

This keeps the reducer pure while still supporting timed animations.

---

## Collision Detection

Collision is handled by a single function: `isValidPosition` (`src/features/tetris/utils/board.ts:12`).

It iterates every filled cell of the tetromino's shape matrix and checks three conditions against the board:

1. **Left/right bounds** -- `boardX < 0 || boardX >= BOARD_WIDTH`
2. **Floor bound** -- `boardY >= BOARD_HEIGHT`
3. **Occupied cell** -- `board[boardY][boardX] !== null` (only when `boardY >= 0`, allowing pieces to spawn above the visible board)

This function is called:
- On every lateral move, down move, and tick.
- During rotation -- with a **basic wall-kick system** that tries the rotated position, then +1x, then -1x before giving up.
- When computing the **ghost piece** position (`getBoardWithGhost`) -- it drops the tetromino down row by row until `isValidPosition` returns false, giving the landing preview.
- On **hard drop** -- same ghost calculation, then the piece is instantly placed there.

The approach is intentionally brute-force (iterate every cell, every time) because the shape matrices are at most 4x4 -- 16 checks per call is negligible.

---

## Render Optimisation

### Memoised Board Construction

The `Board` component (`src/features/tetris/components/Board.tsx`) is wrapped in `React.memo`. Before rendering, it builds a flat render-board via `buildRenderBoard` inside `useMemo` keyed on `[board, current]`. This merges the static board, the ghost piece, and the active piece into a single 2D array of `{ value, isGhost }` objects -- so the 200 `Cell` components receive stable props and skip re-rendering when nothing changed in their position.

### Memoised Cells

Each `Cell` (`src/features/tetris/components/Cell.tsx`) is individually wrapped in `React.memo`. Since cells receive primitive props (`value: string | null`, `isGhost: boolean`), React's shallow comparison is cheap and effective. On a typical tick only ~4-8 cells change (the old and new position of the active piece), so ~192 of 200 cells bail out.

### Ref-based Callback in Game Loop

`useGameLoop` stores the tick callback in a `useRef`, so the `setInterval` is only created/destroyed when the interval duration or active state changes -- not on every render. This avoids the classic problem of stale closures or excessive interval churn.

### Reducer Architecture

All game state is managed by `useReducer`, which batches state updates into a single render per action. There is no cascade of `useState` calls triggering multiple re-renders per tick.

### Cleared-Rows Set

The `clearedRows` array is converted to a `Set` via `useMemo` to give O(1) lookups when deciding which rows to animate, instead of scanning the array for each of the 200 cells.

---

## Challenges & Solutions

### 1. Keeping the Reducer Pure with Timed Animations

**Challenge:** Line-clear animations need a 400 ms delay before rows are removed, but reducers must be synchronous and side-effect-free.

**Solution:** Introduced a `'clearing'` game status. The reducer sets it and records which rows are full. A `useEffect` in `useTetris` watches for this status and fires a timeout that dispatches `FINISH_CLEAR` back to the reducer. The reducer stays pure; the effect handles the timing.

### 2. Server-Side Score Validation

**Challenge:** A desktop game is fully inspectable by whoever runs it -- POST any score you want to the API.

**Solution:** A multi-layered validation pipeline in `submit-score`. Game sessions are created server-side with a cryptographic token. The client must prove continuous play via heartbeats, and the heartbeat counter is incremented atomically in SQL so it cannot be inflated by firing requests in parallel. Submitted scores are cross-checked against theoretical min/max values derived from the number of lines cleared. Level must be consistent with lines. Session duration must be physically plausible, measured against database timestamps rather than the client's clock. The client cannot write to `scores` at all -- it has no database access.

### 3. Ghost Piece Without Extra Renders

**Challenge:** Showing a ghost (landing preview) piece requires computing where the active piece would land, but this is an O(n) vertical scan that runs every render.

**Solution:** The ghost position is computed inside `buildRenderBoard` which is itself memoised via `useMemo`. It only recomputes when `board` or `current` changes. The ghost is stamped directly onto the render-board array so it doesn't add extra DOM elements or a separate render pass.

### 4. Stale Closure in setInterval

**Challenge:** `setInterval` captures the callback at creation time. If the callback references state, it goes stale.

**Solution:** `useGameLoop` stores the callback in a `useRef` that is updated every render. The interval always calls `callbackRef.current`, which points to the latest closure. The interval itself only re-creates when `intervalMs` or `active` changes.

### 5. Mobile Layout Without Scroll

**Challenge:** The full board + controls need to fit a phone screen without any scrolling.

**Solution:** The mobile layout uses `h-[calc(100dvh-48px)]` (accounting for the navbar), CSS Grid for the board with `aspect-ratio: 10 / 20`, and a `flex-1 min-h-0` container that lets the board fill whatever vertical space remains. Stats and controls are fixed-height strips above and below.

---

## Local Development

### Client

```bash
npm install
npm run dev          # Vite + Electron
```

`.env` in the project root holds one variable (copy from `.env.example`):

```
VITE_API_URL=https://nexgrid-api.nexgrid-api.workers.dev
```

It defaults to the deployed API so a locally built desktop app never ships
pointing at localhost. Point it at `http://127.0.0.1:8787` only while running
the Worker locally.

Production checks:

```bash
npm run typecheck
npm run lint
npm run build
```

### Worker API

```bash
cd worker
npm install
npm run migrate      # applies migrations/*.sql to Neon, idempotent
npm run dev          # local Worker on :8787
npm run deploy
```

`worker/.dev.vars` supplies secrets locally and is gitignored. In production the
same names are Worker secrets, set with `wrangler secret put`:

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | HS256 signing key for access tokens |

Non-secret configuration (`R2_PUBLIC_URL`, `ALLOWED_ORIGINS`) lives in
`worker/wrangler.toml`. Add any new frontend origin to `ALLOWED_ORIGINS`;
the packaged desktop app needs no entry, since it sends no `Origin` header.

### Releases

Pushing a `v*` tag builds and publishes a GitHub release, which is also the
auto-update feed. The build needs a `VITE_API_URL` repository secret. The
Microsoft Store package is built separately with `npm run dist:store`, and
disables the self-updater — Store apps are updated by the Store.

---

## License

MIT
