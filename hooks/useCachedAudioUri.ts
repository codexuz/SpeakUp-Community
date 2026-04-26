import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';

export async function cacheAudioUri(url: string): Promise<string> {
  if (url.startsWith('file://') || url.startsWith('data:')) {
    return url;
  }

  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      url
    );
    
    const cacheDir = `${FileSystem.documentDirectory}audio_cache/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
    const ext = extMatch ? extMatch[1] : 'mp3';
    const fileUri = `${cacheDir}${hash}.${ext}`;

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      return fileUri;
    }

    const downloadResult = await FileSystem.downloadAsync(url, fileUri);
    return downloadResult.uri;
  } catch (err) {
    console.warn('Failed to cache audio:', err);
    return url;
  }
}

/**
 * Downloads and caches an audio URI locally so it doesn't need to be downloaded again.
 */
export function useCachedAudioUri(url: string | null) {
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setCachedUri(null);
      return;
    }

    let isMounted = true;

    async function checkAndCache() {
      const resultUri = await cacheAudioUri(url!);
      if (isMounted) {
        setCachedUri(resultUri);
      }
    }

    checkAndCache();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return cachedUri;
}
