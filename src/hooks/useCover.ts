import { useEffect, useState } from 'react';
import type { Book } from '../types/book';
import { storage } from '../services/storage';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function blobUrl(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(id);
  if (!p) {
    p = storage
      .getCover(id)
      .then((blob) => {
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        cache.set(id, url);
        return url;
      })
      .catch(() => null)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

/** Resolve the best available cover URL: stored blob first, then the remote URL. */
export function useCover(book?: Pick<Book, 'coverBlobId' | 'coverUrl'> | null): string | null {
  const blobId = book?.coverBlobId;
  const remote = book?.coverUrl ?? null;
  const [url, setUrl] = useState<string | null>(() => (blobId ? cache.get(blobId) ?? null : remote));
  useEffect(() => {
    let alive = true;
    if (!blobId) {
      setUrl(remote);
      return;
    }
    const hit = cache.get(blobId);
    if (hit) {
      setUrl(hit);
      return;
    }
    blobUrl(blobId).then((u) => alive && setUrl(u ?? remote));
    return () => {
      alive = false;
    };
  }, [blobId, remote]);
  return url;
}
