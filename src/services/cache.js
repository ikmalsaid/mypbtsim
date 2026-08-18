/**
 * Multi-Tier Caching Service (Memory + LocalStorage)
 * Cache is currently DISABLED per user requirement.
 * All requests will query live OSM APIs directly.
 */

const MEMORY_CACHE = new Map();
const CACHE_PREFIX = 'mypbtsim_cache_';
const DEFAULT_GEOCODE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_OVERPASS_TTL_MS = 24 * 60 * 60 * 1000;    // 24 hours

export class CacheService {
  // Master flag: caching disabled
  static enabled = false;

  /**
   * Generates sanitized cache key
   */
  static generateKey(namespace, param) {
    const cleanParam = String(param).toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '_');
    return `${CACHE_PREFIX}${namespace}_${cleanParam}`;
  }

  /**
   * Gets item from memory or localStorage (Bypassed if disabled)
   */
  static get(namespace, param) {
    if (!this.enabled) {
      return null;
    }

    const key = this.generateKey(namespace, param);

    // 1. Check in-memory cache first (fastest)
    if (MEMORY_CACHE.has(key)) {
      const entry = MEMORY_CACHE.get(key);
      if (Date.now() < entry.expiresAt) {
        return { data: entry.data, fromCache: true, source: 'memory' };
      }
      MEMORY_CACHE.delete(key);
    }

    // 2. Check localStorage
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const entry = JSON.parse(stored);
        if (Date.now() < entry.expiresAt) {
          MEMORY_CACHE.set(key, entry);
          return { data: entry.data, fromCache: true, source: 'storage' };
        }
        localStorage.removeItem(key);
      }
    } catch (err) {
      // LocalStorage disabled or quota exceeded
    }

    return null;
  }

  /**
   * Saves item to memory and localStorage (Bypassed if disabled)
   */
  static set(namespace, param, data, ttlMs = DEFAULT_GEOCODE_TTL_MS) {
    if (!this.enabled) {
      return;
    }

    const key = this.generateKey(namespace, param);
    const entry = {
      data,
      savedAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };

    MEMORY_CACHE.set(key, entry);

    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (err) {
      this.pruneOldEntries();
    }
  }

  /**
   * Prunes expired cache entries
   */
  static pruneOldEntries() {
    try {
      const keysToRemove = [];
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            if (item && item.expiresAt < now) {
              keysToRemove.push(k);
            }
          } catch (e) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Clear all app caches
   */
  static clearAll() {
    MEMORY_CACHE.clear();
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // ignore
    }
  }
}

// Clear any existing cached entries on load
CacheService.clearAll();
