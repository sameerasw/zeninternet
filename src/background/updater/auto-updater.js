/**
 * Auto-updater for fetching and updating styles automatically
 */

import { DEFAULT_REPOSITORY_URL } from "../../shared/constants.js";
import { FetchService } from "../../shared/services/fetch-service.js";
import { settingsManager } from "../core/settings-manager.js";
import { cssProcessor } from "../styling/css-processor.js";

/**
 * Auto Updater class for handling automatic style updates
 */
export class AutoUpdater {
  constructor() {
    this.fetchService = new FetchService();
    this.updateInterval = null;
    this.intervalDuration = 2 * 60 * 60 * 1000; // 2 hours
    this.logging = true;
  }

  /**
   * Start auto-update process
   */
  async start() {
    try {
      const settings = await settingsManager.getGlobalSettings();

      if (!settings.autoUpdate) {
        if (this.logging) {
          console.log("DEBUG: Auto-update disabled, not starting");
        }
        return;
      }

      if (this.updateInterval) {
        this.stop();
      }

      // Perform initial update
      await this.performUpdate();

      // Set up recurring updates
      this.updateInterval = setInterval(() => {
        this.performUpdate();
      }, this.intervalDuration);

      if (this.logging) {
        console.log("DEBUG: Auto-updater started");
      }
    } catch (error) {
      console.error("Error starting auto-updater:", error);
    }
  }

  /**
   * Stop auto-update process
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;

      if (this.logging) {
        console.log("DEBUG: Auto-updater stopped");
      }
    }
  }

  /**
   * Perform a style update
   * @returns {Promise<boolean>} - Success status
   */
  async performUpdate() {
    try {
      if (this.logging) {
        console.log("DEBUG: Performing style update");
      }

      const repositoryUrl = await this.getRepositoryUrl();
      const styles = await this.fetchService.fetchStyles(repositoryUrl);

      // Save the styles
      const success = await this.saveStyles(styles);

      if (success) {
        // Update last fetched time
        await this.updateLastFetchedTime();

        // Reprocess and cache styles
        await cssProcessor.preloadStyles();

        if (this.logging) {
          console.log("DEBUG: Style update completed successfully");
        }
      }

      return success;
    } catch (error) {
      console.error("Error performing style update:", error);
      return false;
    }
  }

  /**
   * Get repository URL from settings
   * @returns {Promise<string>} - Repository URL
   */
  async getRepositoryUrl() {
    try {
      const data = await browser.storage.local.get("stylesRepositoryUrl");
      return data.stylesRepositoryUrl || DEFAULT_REPOSITORY_URL;
    } catch (error) {
      console.error("Error getting repository URL:", error);
      return DEFAULT_REPOSITORY_URL;
    }
  }

  /**
   * Save styles to storage
   * @param {Object} styles - Styles data
   * @returns {Promise<boolean>} - Success status
   */
  async saveStyles(styles) {
    try {
      await browser.storage.local.set({ styles });
      return true;
    } catch (error) {
      console.error("Error saving styles:", error);
      return false;
    }
  }

  /**
   * Update last fetched timestamp
   * @returns {Promise<void>}
   */
  async updateLastFetchedTime() {
    try {
      const settings = await settingsManager.getGlobalSettings();
      settings.lastFetchedTime = Date.now();
      await settingsManager.setGlobalSettings(settings);
    } catch (error) {
      console.error("Error updating last fetched time:", error);
    }
  }

  /**
   * Trigger manual update
   * @returns {Promise<boolean>} - Success status
   */
  async triggerManualUpdate() {
    if (this.logging) {
      console.log("DEBUG: Manual update triggered");
    }

    return await this.performUpdate();
  }

  /**
   * Check if auto-update is enabled
   * @returns {Promise<boolean>} - Whether auto-update is enabled
   */
  async isEnabled() {
    try {
      const settings = await settingsManager.getGlobalSettings();
      return settings.autoUpdate || false;
    } catch (error) {
      console.error("Error checking auto-update status:", error);
      return false;
    }
  }

  /**
   * Enable auto-update
   * @returns {Promise<void>}
   */
  async enable() {
    try {
      await settingsManager.setSetting("autoUpdate", true);
      await this.start();
    } catch (error) {
      console.error("Error enabling auto-update:", error);
    }
  }

  /**
   * Disable auto-update
   * @returns {Promise<void>}
   */
  async disable() {
    try {
      await settingsManager.setSetting("autoUpdate", false);
      this.stop();
    } catch (error) {
      console.error("Error disabling auto-update:", error);
    }
  }

  /**
   * Get last update time
   * @returns {Promise<number|null>} - Last update timestamp or null
   */
  async getLastUpdateTime() {
    try {
      const settings = await settingsManager.getGlobalSettings();
      return settings.lastFetchedTime || null;
    } catch (error) {
      console.error("Error getting last update time:", error);
      return null;
    }
  }

  /**
   * Format last update time for display
   * @returns {Promise<string>} - Formatted time string
   */
  async getFormattedLastUpdateTime() {
    try {
      const lastUpdate = await this.getLastUpdateTime();

      if (!lastUpdate) {
        return "Never";
      }

      const date = new Date(lastUpdate);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        return "Just now";
      } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      } else {
        return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      }
    } catch (error) {
      console.error("Error formatting last update time:", error);
      return "Unknown";
    }
  }
}

// Export singleton instance
export const autoUpdater = new AutoUpdater();
