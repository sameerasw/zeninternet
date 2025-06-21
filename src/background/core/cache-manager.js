/**
 * Cache manager for CSS and styling state caching
 */

/**
 * Cache Manager class for managing CSS and styling state caches
 */
export class CacheManager {
  constructor() {
    this.cssCache = new Map();
    this.stylingStateCache = new Map();
    this.maxCacheSize = 1000;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get CSS from cache
   * @param {string} hostname - Hostname to get CSS for
   * @returns {string|null} - Cached CSS or null
   */
  getCss(hostname) {
    const cacheEntry = this.cssCache.get(hostname);
    if (cacheEntry && this.isEntryValid(cacheEntry)) {
      return cacheEntry.data;
    }

    // Remove expired entry
    if (cacheEntry) {
      this.cssCache.delete(hostname);
    }

    return null;
  }

  /**
   * Set CSS in cache
   * @param {string} hostname - Hostname to cache CSS for
   * @param {string} css - CSS to cache
   */
  setCss(hostname, css) {
    this.ensureCacheSize();

    this.cssCache.set(hostname, {
      data: css,
      timestamp: Date.now(),
    });
  }

  /**
   * Get styling state from cache
   * @param {string} hostname - Hostname to get styling state for
   * @returns {Object|null} - Cached styling state or null
   */
  getStylingState(hostname) {
    const cacheKey = `styling:${hostname}`;
    const cacheEntry = this.stylingStateCache.get(cacheKey);

    if (cacheEntry && this.isEntryValid(cacheEntry)) {
      return cacheEntry.data;
    }

    // Remove expired entry
    if (cacheEntry) {
      this.stylingStateCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Set styling state in cache
   * @param {string} hostname - Hostname to cache styling state for
   * @param {Object} state - Styling state to cache
   */
  setStylingState(hostname, state) {
    const cacheKey = `styling:${hostname}`;
    this.ensureCacheSize();

    this.stylingStateCache.set(cacheKey, {
      data: state,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if cache entry is valid (not expired)
   * @param {Object} entry - Cache entry
   * @returns {boolean} - Whether entry is valid
   */
  isEntryValid(entry) {
    return Date.now() - entry.timestamp < this.cacheTimeout;
  }

  /**
   * Ensure cache doesn't exceed maximum size
   */
  ensureCacheSize() {
    // Clean up CSS cache
    if (this.cssCache.size >= this.maxCacheSize) {
      const oldestKey = this.cssCache.keys().next().value;
      this.cssCache.delete(oldestKey);
    }

    // Clean up styling state cache
    if (this.stylingStateCache.size >= this.maxCacheSize) {
      const oldestKey = this.stylingStateCache.keys().next().value;
      this.stylingStateCache.delete(oldestKey);
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.cssCache.clear();
    this.stylingStateCache.clear();
  }

  /**
   * Clear CSS cache
   */
  clearCssCache() {
    this.cssCache.clear();
  }

  /**
   * Clear styling state cache
   */
  clearStylingStateCache() {
    this.stylingStateCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    return {
      cssCache: {
        size: this.cssCache.size,
        maxSize: this.maxCacheSize,
      },
      stylingStateCache: {
        size: this.stylingStateCache.size,
        maxSize: this.maxCacheSize,
      },
      cacheTimeout: this.cacheTimeout,
    };
  }

  /**
   * Clean expired entries from all caches
   */
  cleanExpired() {
    const now = Date.now();

    // Clean CSS cache
    for (const [key, entry] of this.cssCache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.cssCache.delete(key);
      }
    }

    // Clean styling state cache
    for (const [key, entry] of this.stylingStateCache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.stylingStateCache.delete(key);
      }
    }
  }

  /**
   * Check if hostname has cached CSS
   * @param {string} hostname - Hostname to check
   * @returns {boolean} - Whether hostname has cached CSS
   */
  hasCss(hostname) {
    return this.cssCache.has(hostname);
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
