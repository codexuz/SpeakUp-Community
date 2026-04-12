import { createClient } from '@supabase/supabase-js'

// Simple in-memory storage adapter (works in Expo Go without native modules)
// We use custom auth via public.users table, so Supabase Auth sessions aren't needed
const memoryStorage = {
  _store: new Map<string, string>(),
  getItem(key: string) { return this._store.get(key) ?? null },
  setItem(key: string, value: string) { this._store.set(key, value) },
  removeItem(key: string) { this._store.delete(key) },
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: memoryStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
)
