/**
 * Storage Manager for Zen Internet extension
 * Handles all storage-related operations with caching
 */

import { BaseService } from "../../shared/services/base-service.js";
import { STORAGE_KEYS } from "../../shared/constants.js";
import { ensureDefaultSettings } from "../../shared/defaults.js";
import {
  getStorageData,
  setStorageData,
} from "../../shared/utils/storage-utils.js";

export class StorageManager extends BaseService {
  constructor() {
    super("StorageManager");
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Gets data from storage with caching
   * @param {string} key - Storage key
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<any>} - Storage data
   */
  async get(key, useCache = true) {
    const cacheKey = `get_${key}`;

    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.log(`Cache hit for key: ${key}`);
        return cached.data;
      }
    }

    const data = await getStorageData(key);

    if (useCache) {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }

    return data;
  }

  /**
   * Sets data in storage and updates cache
   * @param {Object} data - Data to store
   * @returns {Promise<boolean>} - Success status
   */
  async set(data) {
    const success = await setStorageData(data);

    if (success) {
      // Invalidate related cache entries
      for (const key of Object.keys(data)) {
        this.invalidateCache(`get_${key}`);
      }
    }

    return success;
  }

  /**
   * Gets global settings with defaults
   * @returns {Promise<Object>} - Global settings
   */
  async getGlobalSettings() {
    const data = await this.get(STORAGE_KEYS.BROWSER_STORAGE);
    return ensureDefaultSettings(data[STORAGE_KEYS.BROWSER_STORAGE] || {});
  }

  /**
   * Saves global settings
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveGlobalSettings(settings) {
    const validatedSettings = ensureDefaultSettings(settings);
    return await this.set({
      [STORAGE_KEYS.BROWSER_STORAGE]: validatedSettings,
    });
  }

  /**
   * Gets site-specific settings
   * @param {string} hostname - Hostname to get settings for
   * @returns {Promise<Object>} - Site settings
   */
  async getSiteSettings(hostname) {
    const siteKey = `${STORAGE_KEYS.BROWSER_STORAGE}.${hostname}`;
    const data = await this.get(siteKey);
    return data[siteKey] || {};
  }

  /**
   * Saves site-specific settings
   * @param {string} hostname - Hostname to save settings for
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveSiteSettings(hostname, settings) {
    const siteKey = `${STORAGE_KEYS.BROWSER_STORAGE}.${hostname}`;
    return await this.set({ [siteKey]: settings });
  }

  /**
   * Gets a list from storage
   * @param {string} listKey - Storage key for the list
   * @returns {Promise<string[]>} - The list
   */
  async getList(listKey) {
    const data = await this.get(listKey);
    return data[listKey] || [];
  }

  /**
   * Saves a list to storage
   * @param {string} listKey - Storage key for the list
   * @param {string[]} list - List to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveList(listKey, list) {
    return await this.set({ [listKey]: list });
  }

  /**
   * Adds an item to a list
   * @param {string} listKey - Storage key for the list
   * @param {string} item - Item to add
   * @returns {Promise<boolean>} - Success status
   */
  async addToList(listKey, item) {
    const list = await this.getList(listKey);
    if (!list.includes(item)) {
      list.push(item);
      return await this.saveList(listKey, list);
    }
    return true;
  }

  /**
   * Removes an item from a list
   * @param {string} listKey - Storage key for the list
   * @param {string} item - Item to remove
   * @returns {Promise<boolean>} - Success status
   */
  async removeFromList(listKey, item) {
    const list = await this.getList(listKey);
    const index = list.indexOf(item);
    if (index !== -1) {
      list.splice(index, 1);
      return await this.saveList(listKey, list);
    }
    return true;
  }

  /**
   * Invalidates cache for a specific key
   * @param {string} key - Cache key to invalidate
   */
  invalidateCache(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.log(`Cache invalidated for key: ${key}`);
    }
  }

  /**
   * Clears all cache
   */
  clearCache() {
    this.cache.clear();
    this.log("All cache cleared");
  }

  /**
   * Clears all storage data
   * @returns {Promise<boolean>} - Success status
   */
  async clearAll() {
    try {
      await browser.storage.local.clear();
      this.clearCache();
      this.log("All storage data cleared");
      return true;
    } catch (error) {
      this.logError("Error clearing all data", error);
      return false;
    }
  }
}
