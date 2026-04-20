# Expo Local-First SQLite Database

Telegram-style offline-first database for the SpeakUp Community Expo app. The app works instantly from local cache and syncs with the server in the background.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | SQLite DDL – all tables, indexes, sync columns |
| `database.ts` | DB init, CRUD helpers, sync queue, bulk upsert |
| `syncService.ts` | Push/pull sync engine with conflict resolution |
| `offlineApi.ts` | Domain-specific offline presets (tests, groups, community, etc.) |
| `offlineChat.ts` | Offline-first group chat with optimistic sends |
| `mediaCache.ts` | Image/audio/video file caching for offline access |
| `index.ts` | Barrel export – import everything from `@/expo-local-db` |
| `hooks/useNetwork.ts` | Real-time connectivity status hook |
| `hooks/useOfflineFirst.ts` | Generic offline-first data hook (read local → fetch API → update cache) |
| `hooks/useOfflineMutation.ts` | Optimistic write hook (write local → sync to server) |
| `components/OfflineIndicator.tsx` | Connection status banner (slides down when offline) |
| `components/PendingBadge.tsx` | Badge showing pending sync item count |
| `components/CachedImage.tsx` | Image component with local media cache |

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

### 3. Already integrated in app root

The root layout (`app/_layout.tsx`) already:
- Initializes the local database on mount
- Starts the sync service when authenticated
- Shows the `OfflineIndicator` banner
- Cleans old media cache entries

## How It Works (Telegram-style)

```
┌─────────────────────────────────────────────────────┐
│                    React Screen                      │
│  useOfflineFirst({ table, apiFn })                  │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ 1. Read SQLite   │  │ 2. Background API fetch  │   │
│  │    (instant UI)  │  │    (if online & stale)   │   │
│  └────────┬────────┘  └───────────┬─────────────┘   │
│           │                       │                  │
│           ▼                       ▼                  │
│  ┌─────────────────────────────────────────────┐    │
│  │           SQLite (source of truth)            │    │
│  │   sync_status = 'synced' | 'pending'          │    │
│  └─────────────────────┬───────────────────────┘    │
└─────────────────────────┼───────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │     Sync Service       │
              │  push pending → server │
              │  pull updates ← server │
              └───────────────────────┘
```

### Offline Reads
1. `useOfflineFirst` reads from SQLite **immediately** → UI renders with cached data
2. If online and data is stale (older than `staleTime`), fetches from API in background
3. API response is upserted into SQLite → hook re-reads → UI updates seamlessly

### Offline Writes
1. `useOfflineMutation` writes to SQLite **immediately** with `sync_status = 'pending'`
2. Change is enqueued in `sync_queue`
3. If online, attempts API call right away; if offline, the sync service picks it up later

### Offline Chat
1. `useOfflineChat` loads messages from SQLite first (instant render)
2. New messages are written locally with a temp UUID, shown with a "pending" indicator
3. When online, messages are sent to server and the temp ID is replaced with the server ID

## Usage Examples

### Reading data (offline-first list)

```tsx
import { useOfflineFirst } from '@/expo-local-db';
import { offlineMyGroups } from '@/expo-local-db/offlineApi';

function GroupsScreen() {
  const { data: groups, isLoading, isRefreshing, refresh } = useOfflineFirst(offlineMyGroups());

  return (
    <FlatList
      data={groups}
      refreshing={isRefreshing}
      onRefresh={refresh}
      renderItem={({ item }) => <GroupCard group={item} />}
    />
  );
}
```

### Writing data (optimistic mutation)

```tsx
import { useOfflineMutation } from '@/expo-local-db';
import { offlineLikeSession } from '@/expo-local-db/offlineApi';

function LikeButton({ sessionId, userId }) {
  const { mutate, isLoading } = useOfflineMutation(offlineLikeSession(sessionId));

  return (
    <Pressable onPress={() => mutate({ userId })} disabled={isLoading}>
      <HeartIcon />
    </Pressable>
  );
}
```

### Offline chat

```tsx
import { useOfflineChat } from '@/expo-local-db';

function ChatScreen({ groupId, currentUser }) {
  const { messages, sendText, loadMessages, markRead } = useOfflineChat({
    groupId,
    currentUser,
  });

  useEffect(() => { loadMessages(); }, []);

  return (
    <FlatList
      data={messages}
      inverted
      renderItem={({ item }) => (
        <MessageBubble message={item} isPending={item._pending} />
      )}
    />
  );
}
```

### Cached images

```tsx
import { CachedImage } from '@/expo-local-db';

<CachedImage uri={user.avatarUrl} style={{ width: 40, height: 40 }} />
```

### Offline indicator & pending badge

```tsx
import { OfflineIndicator, PendingBadge } from '@/expo-local-db';

// OfflineIndicator is already in the root layout
// Use PendingBadge in tab bars or headers:
<PendingBadge table="group_messages" />
```
