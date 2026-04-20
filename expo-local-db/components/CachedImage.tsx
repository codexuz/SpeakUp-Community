/**
 * CachedImage — drops in for expo-image / RN Image.
 * Checks local media cache first, falls back to remote URL.
 */

import { Image as ExpoImage, ImageProps as ExpoImageProps } from "expo-image";
import React, { useEffect, useState } from "react";
import { getCachedUri } from "../mediaCache";

interface CachedImageProps extends Omit<ExpoImageProps, "source"> {
  uri: string | null | undefined;
  /** Fallback placeholder when no image available */
  fallback?: ExpoImageProps["source"];
}

export function CachedImage({ uri, fallback, ...props }: CachedImageProps) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) {
      setResolvedUri(null);
      return;
    }

    let cancelled = false;

    // Try cache first
    getCachedUri(uri).then((localUri) => {
      if (cancelled) return;
      setResolvedUri(localUri ?? uri);
    });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!resolvedUri && !fallback) return null;

  return (
    <ExpoImage
      {...props}
      source={resolvedUri ? { uri: resolvedUri } : fallback}
      cachePolicy="memory-disk"
    />
  );
}
