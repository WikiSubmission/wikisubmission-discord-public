import NodeCache from "node-cache";
import { getSupabaseInternalClient } from "./get-supabase-internal-client";

// Local in-memory cache as fallback when DB is not available
const localCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

interface CachedPageData {
  user_id: string;
  title: string;
  footer: string;
  total_pages: number;
  content: string[];
}

/**
 * Cache pagination data - tries DB first, falls back to local cache
 */
export async function cachePageData(
  interactionId: string,
  data: CachedPageData
): Promise<void> {
  try {
    const db = getSupabaseInternalClient();
    if (db) {
      await db.from("ws_discord_cache").upsert({
        key: interactionId,
        value: JSON.stringify(data),
      });
      return;
    }
  } catch (error) {
    // DB error, fall through to local cache
  }

  // DB unavailable or null, use local cache
  localCache.set(interactionId, data);
}

/**
 * Retrieve cached pagination data - tries DB first, falls back to local cache
 */
export async function getCachedPageData(
  interactionId: string
): Promise<CachedPageData | null> {
  try {
    const db = getSupabaseInternalClient();
    if (db) {
      const request = await db
        .from("ws_discord_cache")
        .select("*")
        .eq("key", interactionId)
        .single();

      if (request.data?.value) {
        return JSON.parse(request.data.value);
      }
    }
  } catch (error) {
    // DB error, fall through to local cache
  }

  // DB unavailable or null, try local cache
  const cached = localCache.get<CachedPageData>(interactionId);
  if (cached) {
    return cached;
  }

  return null;
}
