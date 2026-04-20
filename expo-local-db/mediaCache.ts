/**
 * Telegram-style media cache.
 * Downloads images, audio, and video files to local storage
 * so they render instantly when offline.
 */

import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";

const CACHE_DIR = `${FileSystem.cacheDirectory}media-cache/`;

// Ensure cache directory exists
let _dirReady = false;
async function ensureCacheDir(): Promise<void> {
  if (_dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  _dirReady = true;
}

// ─── URL → Local Path ──────────────────────────────────────────

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop() ?? "";
    // Only keep common extensions
    if (/^(jpg|jpeg|png|gif|webp|mp3|m4a|wav|ogg|mp4|mov|pdf)$/i.test(ext)) {
      return `.${ext.toLowerCase()}`;
    }
  } catch {
    /* ignore */
  }
  return "";
}

async function urlToLocalPath(url: string): Promise<string> {
  await ensureCacheDir();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  return `${CACHE_DIR}${hash}${getExtension(url)}`;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get a local file URI for the given remote URL.
 * Downloads and caches the file if not already present.
 * Returns `null` if download fails (caller should fall back to remote URL).
 */
export async function getCachedUri(remoteUrl: string): Promise<string | null> {
  if (!remoteUrl) return null;

  // Already a local URI
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("/")) {
    return remoteUrl;
  }

  try {
    const localPath = await urlToLocalPath(remoteUrl);
    const info = await FileSystem.getInfoAsync(localPath);

    if (info.exists) {
      return localPath;
    }

    // Download
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    if (result.status === 200) {
      return localPath;
    }

    // Download failed — clean up partial file
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    return null;
  } catch {
    return null;
  }
}

/**
 * Prefetch an array of URLs into cache (e.g., group avatars, feed images).
 * Runs concurrently with a concurrency limit of 4.
 */
export async function prefetchMedia(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  const concurrency = 4;

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    await Promise.allSettled(batch.map((url) => getCachedUri(url)));
  }
}

/**
 * Check if a remote URL is already cached locally.
 */
export async function isCached(remoteUrl: string): Promise<boolean> {
  if (!remoteUrl) return false;
  try {
    const localPath = await urlToLocalPath(remoteUrl);
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Get the cached local path without downloading.
 * Returns null if not cached.
 */
export async function getCachedPath(remoteUrl: string): Promise<string | null> {
  if (!remoteUrl) return null;
  try {
    const localPath = await urlToLocalPath(remoteUrl);
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
}

/**
 * Clear expired cache entries older than `maxAgeMs` (default: 7 days).
 */
export async function clearOldCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const now = Date.now();

    for (const file of files) {
      const fullPath = `${CACHE_DIR}${file}`;
      const info = await FileSystem.getInfoAsync(fullPath);
      if (info.exists && info.modificationTime) {
        const age = now - info.modificationTime * 1000;
        if (age > maxAgeMs) {
          await FileSystem.deleteAsync(fullPath, { idempotent: true });
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Get total cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  try {
    await ensureCacheDir();
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let total = 0;
    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
      if (info.exists && info.size) {
        total += info.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Clear entire media cache.
 */
export async function clearCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    _dirReady = false;
  } catch {
    /* ignore */
  }
}
