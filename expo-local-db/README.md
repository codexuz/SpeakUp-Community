# Expo Local-First SQLite Database

Local-first offline database for the SpeakUp Community Expo app, mirroring the server Prisma/PostgreSQL schema.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | SQLite DDL – all tables, indexes, sync columns |
| `database.ts` | DB init, CRUD helpers, sync queue, bulk upsert |
| `syncService.ts` | Push/pull sync engine with conflict resolution |

## Setup

### 1. Install dependencies

```bash
npx expo install expo-sqlite expo-file-system expo-asset expo-crypto @react-native-community/netinfo
```

### 2. Add `.sql` to Metro asset extensions

In `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("sql");
module.exports = config;
```

### 3. Initialize on app start

```ts
import { getDatabase } from "./expo-local-db/database";
import { startSyncService } from "./expo-local-db/syncService";

// In your root component or App.tsx
useEffect(() => {
  getDatabase(); // Creates tables on first launch
  startSyncService("https://api.speakup.com", () => authToken);
}, []);
```

## Sync Architecture

```
┌─────────────┐     push (pending rows)     ┌──────────────┐
│  SQLite DB   │ ──────────────────────────► │  Server API  │
│  (expo-sqlite)│ ◄────────────────────────── │  (Postgres)  │
└─────────────┘     pull (since timestamp)   └──────────────┘
```

- **Offline writes** go into the local SQLite DB with `sync_status = 'pending'`.
- Every write also enqueues a row in `sync_queue`.
- When online, the sync service pushes pending changes and pulls server updates.
- Server-only content (courses, tests, exercises) is pulled and cached locally.
- Conflicts (HTTP 409) are flagged as `sync_status = 'conflict'` for manual resolution.

## Key Differences from Server Schema

| PostgreSQL | SQLite |
|------------|--------|
| `UUID` / `gen_random_uuid()` | `TEXT` + `expo-crypto` `randomUUID()` |
| `SERIAL` / `BIGSERIAL` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `TIMESTAMPTZ` | `TEXT` (ISO-8601 strings) |
| `JSONB` | `TEXT` (JSON strings, parsed in app) |
| `ENUM` types | `TEXT` (validated in app code) |
| `BOOLEAN` | `INTEGER` (0/1) |

## Every Mutable Table Includes

| Column | Type | Purpose |
|--------|------|---------|
| `sync_status` | `TEXT` | `'synced'` / `'pending'` / `'conflict'` |
| `last_synced_at` | `TEXT` | ISO timestamp of last successful sync |
| `updated_at` | `TEXT` | Set on every local write |
| `is_deleted` | `INTEGER` | Soft-delete flag (0/1) for sync |
