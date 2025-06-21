/**
 * Auto Update Service for Zen Internet extension
 * Handles automatic fetching of styles
 */

import { BaseService } from "../../shared/services/base-service.js";
import {
  STORAGE_KEYS,
  DEFAULT_REPOSITORY_URL,
  AUTO_UPDATE_SETTINGS,
} from "../../shared/constants.js";

export class AutoUpdateService extends BaseService {
  constructor(storageManager, cssManager) {
    super("AutoUpdateService");
    this.storageManager = storageManager;
    this.cssManager = cssManager;
    this.updateInterval = null;
    this.isUpdating = false;
  }

  /**
   * Starts the auto-update service
   */
  start() {
    if (this.updateInterval) {
      this.stop();
    }

    this.updateInterval = setInterval(() => {
      this.fetchStyles();
    }, AUTO_UPDATE_SETTINGS.INTERVAL);

    this.log("Auto-update service started");
  }

  /**
   * Stops the auto-update service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.log("Auto-update service stopped");
    }
  }

  /**
   * Fetches the latest styles from the repository
   * @param {boolean} forced - Whether this is a forced update
   * @returns {Promise<boolean>} - Success status
   */
  async fetchStyles(forced = false) {
    if (this.isUpdating && !forced) {
      this.log("Update already in progress, skipping");
      return false;
    }

    this.isUpdating = true;

    try {
      const repositoryUrl = await this.getRepositoryUrl();
      this.log(`Fetching styles from: ${repositoryUrl}`);

      const response = await fetch(repositoryUrl, {
        headers: AUTO_UPDATE_SETTINGS.CACHE_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const styles = await response.json();

      // Validate the styles data
      if (!this.validateStylesData(styles)) {
        throw new Error("Invalid styles data format");
      }

      // Save the new styles
      const success = await this.storageManager.set({
        [STORAGE_KEYS.STYLES]: styles,
      });

      if (success) {
        // Update last fetched timestamp
        await this.updateLastFetchedTime();

        // Preload the new styles
        await this.cssManager.preloadStyles();

        this.log("Styles updated successfully");
        return true;
      } else {
        throw new Error("Failed to save styles to storage");
      }
    } catch (error) {
      this.logError("Error fetching styles", error);
      return false;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Gets the repository URL from storage
   * @returns {Promise<string>} - Repository URL
   */
  async getRepositoryUrl() {
    const data = await this.storageManager.get(STORAGE_KEYS.REPOSITORY_URL);
    return data[STORAGE_KEYS.REPOSITORY_URL] || DEFAULT_REPOSITORY_URL;
  }

  /**
   * Sets a new repository URL
   * @param {string} url - New repository URL
   * @returns {Promise<boolean>} - Success status
   */
  async setRepositoryUrl(url) {
    try {
      // Validate URL
      new URL(url);

      const success = await this.storageManager.set({
        [STORAGE_KEYS.REPOSITORY_URL]: url,
      });

      if (success) {
        this.log(`Repository URL updated to: ${url}`);
      }

      return success;
    } catch (error) {
      this.logError("Error setting repository URL", error);
      return false;
    }
  }

  /**
   * Resets repository URL to default
   * @returns {Promise<boolean>} - Success status
   */
  async resetRepositoryUrl() {
    return await this.setRepositoryUrl(DEFAULT_REPOSITORY_URL);
  }

  /**
   * Validates styles data format
   * @param {Object} styles - Styles data to validate
   * @returns {boolean} - Whether data is valid
   */
  validateStylesData(styles) {
    if (!styles || typeof styles !== "object") {
      return false;
    }

    // Check for required structure
    if (styles.website && typeof styles.website === "object") {
      // Validate at least one website entry
      const websites = Object.keys(styles.website);
      if (websites.length > 0) {
        // Check first website has valid structure
        const firstWebsite = styles.website[websites[0]];
        return typeof firstWebsite === "object";
      }
    }

    return false;
  }

  /**
   * Updates the last fetched timestamp
   * @returns {Promise<boolean>} - Success status
   */
  async updateLastFetchedTime() {
    try {
      const settings = await this.storageManager.getGlobalSettings();
      settings.lastFetchedTime = Date.now();

      return await this.storageManager.saveGlobalSettings(settings);
    } catch (error) {
      this.logError("Error updating last fetched time", error);
      return false;
    }
  }

  /**
   * Gets the last fetched timestamp
   * @returns {Promise<number|null>} - Timestamp or null
   */
  async getLastFetchedTime() {
    try {
      const settings = await this.storageManager.getGlobalSettings();
      return settings.lastFetchedTime || null;
    } catch (error) {
      this.logError("Error getting last fetched time", error);
      return null;
    }
  }

  /**
   * Gets formatted last fetched time string
   * @returns {Promise<string>} - Formatted time string
   */
  async getLastFetchedTimeString() {
    const timestamp = await this.getLastFetchedTime();

    if (!timestamp) {
      return "Never";
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return "Just now";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Checks if auto-update should be enabled based on settings
   * @returns {Promise<boolean>} - Whether auto-update should be enabled
   */
  async shouldAutoUpdate() {
    const settings = await this.storageManager.getGlobalSettings();
    return settings.autoUpdate !== false;
  }

  /**
   * Initializes auto-update based on stored settings
   */
  async initialize() {
    const shouldUpdate = await this.shouldAutoUpdate();

    if (shouldUpdate) {
      this.start();
      this.log("Auto-update initialized and started");
    } else {
      this.log("Auto-update disabled in settings");
    }
  }

  /**
   * Gets update service statistics
   * @returns {Promise<Object>} - Service statistics
   */
  async getStats() {
    const lastFetched = await this.getLastFetchedTime();
    const lastFetchedString = await this.getLastFetchedTimeString();
    const repositoryUrl = await this.getRepositoryUrl();
    const shouldUpdate = await this.shouldAutoUpdate();

    return {
      isRunning: this.updateInterval !== null,
      isUpdating: this.isUpdating,
      shouldAutoUpdate: shouldUpdate,
      repositoryUrl,
      lastFetched,
      lastFetchedString,
      nextUpdateIn: this.updateInterval ? AUTO_UPDATE_SETTINGS.INTERVAL : null,
    };
  }
}
