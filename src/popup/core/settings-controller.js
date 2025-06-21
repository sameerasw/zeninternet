/**
 * Settings Controller for Zen Internet extension popup
 * Handles settings management and storage operations
 */

import {
  getGlobalSettings,
  saveGlobalSettings,
  getSiteSettings,
  saveSiteSettings,
  getList,
  saveList,
  addToList,
  removeFromList,
} from "../../shared/utils/storage-utils.js";
import { STORAGE_KEYS, MESSAGE_TYPES } from "../../shared/constants.js";
import { ensureDefaultSettings } from "../../shared/defaults.js";

export class SettingsController {
  constructor() {
    this.globalSettings = {};
    this.siteSettings = {};
    this.skipForceThemingList = [];
    this.skipThemingList = [];
    this.fallbackBackgroundList = [];
    this.logging = false;
  }

  /**
   * Gets global settings
   * @returns {Object} - Global settings
   */
  getGlobalSettings() {
    return this.globalSettings;
  }

  /**
   * Sets global settings
   * @param {Object} settings - Settings to set
   */
  async setGlobalSettings(settings) {
    this.globalSettings = ensureDefaultSettings(settings);
    await this.loadLists();
  }

  /**
   * Gets site settings
   * @returns {Object} - Site settings
   */
  getSiteSettings() {
    return this.siteSettings;
  }

  /**
   * Sets site settings
   * @param {Object} settings - Settings to set
   */
  setSiteSettings(settings) {
    this.siteSettings = settings || {};
  }

  /**
   * Saves global settings
   * @returns {Promise<boolean>} - Success status
   */
  async saveGlobalSettings() {
    try {
      const success = await saveGlobalSettings(this.globalSettings);
      if (success) {
        this.log("Global settings saved successfully");
      }
      return success;
    } catch (error) {
      this.logError("Error saving global settings", error);
      return false;
    }
  }

  /**
   * Saves site settings
   * @param {string} hostname - Hostname to save settings for
   * @returns {Promise<boolean>} - Success status
   */
  async saveSiteSettings(hostname) {
    try {
      const success = await saveSiteSettings(hostname, this.siteSettings);
      if (success) {
        this.log(`Site settings saved for ${hostname}`);
      }
      return success;
    } catch (error) {
      this.logError(`Error saving site settings for ${hostname}`, error);
      return false;
    }
  }

  /**
   * Updates a global setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<boolean>} - Success status
   */
  async updateGlobalSetting(key, value) {
    this.globalSettings[key] = value;
    return await this.saveGlobalSettings();
  }

  /**
   * Updates a site setting
   * @param {string} hostname - Hostname
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<boolean>} - Success status
   */
  async updateSiteSetting(hostname, key, value) {
    this.siteSettings[key] = value;
    return await this.saveSiteSettings(hostname);
  }

  /**
   * Loads all lists from storage
   */
  async loadLists() {
    try {
      this.skipForceThemingList = await getList(
        STORAGE_KEYS.SKIP_FORCE_THEMING
      );
      this.skipThemingList = await getList(STORAGE_KEYS.SKIP_THEMING);
      this.fallbackBackgroundList = await getList(
        STORAGE_KEYS.FALLBACK_BACKGROUND
      );

      this.log("Lists loaded from storage");
    } catch (error) {
      this.logError("Error loading lists", error);
    }
  }

  /**
   * Adds or removes a site from a list
   * @param {string} listKey - Storage key for the list
   * @param {string} hostname - Hostname to add/remove
   * @param {boolean} add - Whether to add (true) or remove (false)
   * @returns {Promise<boolean>} - Success status
   */
  async toggleSiteInList(listKey, hostname, add) {
    try {
      let success;

      if (add) {
        success = await addToList(listKey, hostname);
      } else {
        success = await removeFromList(listKey, hostname);
      }

      if (success) {
        // Update local cache
        await this.loadLists();
        this.log(
          `${add ? "Added" : "Removed"} ${hostname} ${
            add ? "to" : "from"
          } ${listKey}`
        );
      }

      return success;
    } catch (error) {
      this.logError(`Error toggling site in list ${listKey}`, error);
      return false;
    }
  }

  /**
   * Checks if a site is in a specific list
   * @param {string} listKey - Storage key for the list
   * @param {string} hostname - Hostname to check
   * @returns {boolean} - Whether site is in the list
   */
  isSiteInList(listKey, hostname) {
    switch (listKey) {
      case STORAGE_KEYS.SKIP_FORCE_THEMING:
        return this.skipForceThemingList.includes(hostname);
      case STORAGE_KEYS.SKIP_THEMING:
        return this.skipThemingList.includes(hostname);
      case STORAGE_KEYS.FALLBACK_BACKGROUND:
        return this.fallbackBackgroundList.includes(hostname);
      default:
        return false;
    }
  }

  /**
   * Handles force theming toggle for a site
   * @param {string} hostname - Hostname
   * @param {boolean} checked - Whether toggle is checked
   * @returns {Promise<boolean>} - Success status
   */
  async handleForceThemingToggle(hostname, checked) {
    // In whitelist mode: checked = include site, unchecked = exclude site
    // In blacklist mode: checked = exclude site, unchecked = include site
    const isWhitelistMode = this.globalSettings.whitelistMode;
    const shouldBeInList = isWhitelistMode ? checked : checked;

    return await this.toggleSiteInList(
      STORAGE_KEYS.SKIP_FORCE_THEMING,
      hostname,
      shouldBeInList
    );
  }

  /**
   * Handles styling toggle for a site
   * @param {string} hostname - Hostname
   * @param {boolean} checked - Whether toggle is checked
   * @returns {Promise<boolean>} - Success status
   */
  async handleStylingToggle(hostname, checked) {
    const isWhitelistMode = this.globalSettings.whitelistStyleMode;
    const shouldBeInList = isWhitelistMode ? checked : checked;

    return await this.toggleSiteInList(
      STORAGE_KEYS.SKIP_THEMING,
      hostname,
      shouldBeInList
    );
  }

  /**
   * Handles fallback background toggle for a site
   * @param {string} hostname - Hostname
   * @param {boolean} checked - Whether toggle is checked
   * @returns {Promise<boolean>} - Success status
   */
  async handleFallbackBackgroundToggle(hostname, checked) {
    return await this.toggleSiteInList(
      STORAGE_KEYS.FALLBACK_BACKGROUND,
      hostname,
      checked
    );
  }

  /**
   * Refetches CSS from the repository
   * @returns {Promise<boolean>} - Success status
   */
  async refetchCSS() {
    try {
      // Send message to background script to refetch CSS
      const response = await browser.runtime.sendMessage({
        action: "refetchCSS",
        forced: true,
      });

      if (response && response.success) {
        this.log("CSS refetch successful");

        // Update last fetched time in settings
        this.globalSettings.lastFetchedTime = Date.now();
        await this.saveGlobalSettings();

        return true;
      } else {
        this.logError("CSS refetch failed", response?.error);
        return false;
      }
    } catch (error) {
      this.logError("Error refetching CSS", error);
      return false;
    }
  }

  /**
   * Enables auto-update
   * @returns {Promise<boolean>} - Success status
   */
  async enableAutoUpdate() {
    try {
      const response = await browser.runtime.sendMessage({
        action: MESSAGE_TYPES.ENABLE_AUTO_UPDATE,
        immediate: false,
      });

      return response && response.success;
    } catch (error) {
      this.logError("Error enabling auto-update", error);
      return false;
    }
  }

  /**
   * Disables auto-update
   * @returns {Promise<boolean>} - Success status
   */
  async disableAutoUpdate() {
    try {
      const response = await browser.runtime.sendMessage({
        action: MESSAGE_TYPES.DISABLE_AUTO_UPDATE,
      });

      return response && response.success;
    } catch (error) {
      this.logError("Error disabling auto-update", error);
      return false;
    }
  }

  /**
   * Gets effective toggle state for a site
   * @param {string} listKey - Storage key for the list
   * @param {string} hostname - Hostname
   * @returns {boolean} - Effective toggle state
   */
  getEffectiveToggleState(listKey, hostname) {
    const isInList = this.isSiteInList(listKey, hostname);

    // For force theming
    if (listKey === STORAGE_KEYS.SKIP_FORCE_THEMING) {
      return isInList;
    }

    // For regular styling
    if (listKey === STORAGE_KEYS.SKIP_THEMING) {
      return isInList;
    }

    // For fallback background
    if (listKey === STORAGE_KEYS.FALLBACK_BACKGROUND) {
      return isInList;
    }

    return false;
  }

  /**
   * Validates settings before saving
   * @param {Object} settings - Settings to validate
   * @returns {Object} - Validation result
   */
  validateSettings(settings) {
    const errors = [];

    // Validate boolean settings
    const booleanKeys = [
      "enableStyling",
      "autoUpdate",
      "forceStyling",
      "whitelistMode",
      "whitelistStyleMode",
      "disableTransparency",
      "disableHover",
      "disableFooter",
    ];

    for (const key of booleanKeys) {
      if (settings[key] !== undefined && typeof settings[key] !== "boolean") {
        errors.push(`${key} must be a boolean`);
      }
    }

    // Validate array settings
    if (
      settings.fallbackBackgroundList !== undefined &&
      !Array.isArray(settings.fallbackBackgroundList)
    ) {
      errors.push("fallbackBackgroundList must be an array");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Exports current settings
   * @returns {Object} - Exported settings data
   */
  async exportSettings() {
    try {
      return {
        globalSettings: this.globalSettings,
        siteSettings: this.siteSettings,
        lists: {
          skipForceTheming: this.skipForceThemingList,
          skipTheming: this.skipThemingList,
          fallbackBackground: this.fallbackBackgroundList,
        },
        exportedAt: Date.now(),
        version: browser.runtime.getManifest().version,
      };
    } catch (error) {
      this.logError("Error exporting settings", error);
      return null;
    }
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet SettingsController] ${message}`, data);
      } else {
        console.log(`[ZenInternet SettingsController] ${message}`);
      }
    }
  }

  /**
   * Logs an error message
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  logError(message, error = null) {
    if (error) {
      console.error(`[ZenInternet SettingsController] ${message}`, error);
    } else {
      console.error(`[ZenInternet SettingsController] ${message}`);
    }
  }
}
