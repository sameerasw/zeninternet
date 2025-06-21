/**
 * Settings Manager for Zen Internet extension
 * Handles settings validation and state management
 */

import { BaseService } from "../../shared/services/base-service.js";
import { STORAGE_KEYS } from "../../shared/constants.js";
import { ensureDefaultSettings } from "../../shared/defaults.js";
import { normalizeHostname } from "../../shared/utils/hostname-utils.js";

export class SettingsManager extends BaseService {
  constructor(storageManager) {
    super("SettingsManager");
    this.storageManager = storageManager;
    this.settingsCache = new Map();
  }

  /**
   * Determines if styling should be applied to a hostname
   * @param {string} hostname - Hostname to check
   * @returns {Promise<Object>} - Styling decision with reason
   */
  async shouldApplyStyling(hostname) {
    const cacheKey = `styling:${hostname}`;

    if (this.settingsCache.has(cacheKey)) {
      return this.settingsCache.get(cacheKey);
    }

    const normalizedHostname = normalizeHostname(hostname);
    const settings = await this.storageManager.getGlobalSettings();

    // If styling is globally disabled
    if (!settings.enableStyling) {
      const result = { shouldApply: false, reason: "globally_disabled" };
      this.settingsCache.set(cacheKey, result);
      return result;
    }

    // Check if we have a specific style for this site
    const hasSpecificStyle = await this.hasSpecificStyleForSite(
      normalizedHostname
    );

    if (hasSpecificStyle) {
      // Check blacklist/whitelist for regular styling
      const skipStyleList = await this.storageManager.getList(
        STORAGE_KEYS.SKIP_THEMING
      );
      const isInSkipList = skipStyleList.includes(normalizedHostname);
      const styleMode = settings.whitelistStyleMode || false;

      if (styleMode) {
        // Whitelist mode: only apply if site is in the list
        if (isInSkipList) {
          const result = { shouldApply: true, reason: "whitelisted_specific" };
          this.settingsCache.set(cacheKey, result);
          return result;
        }
      } else {
        // Blacklist mode: apply unless site is in the list
        if (!isInSkipList) {
          const result = { shouldApply: true, reason: "specific_style" };
          this.settingsCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // Check if force styling should be applied
    if (settings.forceStyling) {
      const skipForceList = await this.storageManager.getList(
        STORAGE_KEYS.SKIP_FORCE_THEMING
      );
      const isInForceSkipList = skipForceList.includes(normalizedHostname);
      const isWhitelistMode = settings.whitelistMode || false;

      if (isWhitelistMode) {
        // Whitelist mode: only apply if site is in the list
        if (isInForceSkipList) {
          const result = { shouldApply: true, reason: "whitelisted_forced" };
          this.settingsCache.set(cacheKey, result);
          return result;
        }
      } else {
        // Blacklist mode: apply unless site is in the list
        if (!isInForceSkipList) {
          const result = { shouldApply: true, reason: "forced_styling" };
          this.settingsCache.set(cacheKey, result);
          return result;
        }
      }
    }

    const result = { shouldApply: false, reason: "no_styling_rules" };
    this.settingsCache.set(cacheKey, result);
    return result;
  }

  /**
   * Checks if a site has specific styling available
   * @param {string} hostname - Normalized hostname
   * @returns {Promise<boolean>} - Whether site has specific styling
   */
  async hasSpecificStyleForSite(hostname) {
    // This would check the CSS cache or styles data
    // For now, return false - this should be implemented based on CSS manager
    return false;
  }

  /**
   * Gets effective settings for a site
   * @param {string} hostname - Hostname to get settings for
   * @returns {Promise<Object>} - Effective settings for the site
   */
  async getEffectiveSettings(hostname) {
    const globalSettings = await this.storageManager.getGlobalSettings();
    const siteSettings = await this.storageManager.getSiteSettings(hostname);
    const fallbackList = await this.storageManager.getList(
      STORAGE_KEYS.FALLBACK_BACKGROUND
    );

    const normalizedHostname = normalizeHostname(hostname);
    const hasFallbackBackground = fallbackList.includes(normalizedHostname);

    return {
      ...globalSettings,
      siteSettings,
      hasFallbackBackground,
      hostname: normalizedHostname,
    };
  }

  /**
   * Validates and saves global settings
   * @param {Object} settings - Settings to validate and save
   * @returns {Promise<Object>} - Result with success status and any errors
   */
  async validateAndSaveSettings(settings) {
    try {
      const validatedSettings = ensureDefaultSettings(settings);
      const success = await this.storageManager.saveGlobalSettings(
        validatedSettings
      );

      if (success) {
        this.clearStyleCache();
        this.log("Settings validated and saved successfully");
      }

      return { success, settings: validatedSettings, errors: [] };
    } catch (error) {
      this.logError("Error validating and saving settings", error);
      return { success: false, settings: null, errors: [error.message] };
    }
  }

  /**
   * Initializes default settings if missing
   * @returns {Promise<boolean>} - Whether initialization was needed
   */
  async initializeDefaultSettings() {
    const currentSettings = await this.storageManager.get(
      STORAGE_KEYS.BROWSER_STORAGE
    );
    const settings = currentSettings[STORAGE_KEYS.BROWSER_STORAGE] || {};
    const validatedSettings = ensureDefaultSettings(settings);

    // Check if we need to save defaults
    if (JSON.stringify(validatedSettings) !== JSON.stringify(settings)) {
      await this.storageManager.saveGlobalSettings(validatedSettings);
      this.log("Default settings initialized");
      return true;
    }

    return false;
  }

  /**
   * Clears styling cache
   */
  clearStyleCache() {
    // Clear all styling-related cache entries
    for (const [key] of this.settingsCache) {
      if (key.startsWith("styling:")) {
        this.settingsCache.delete(key);
      }
    }
    this.log("Styling cache cleared");
  }

  /**
   * Clears all settings cache
   */
  clearCache() {
    this.settingsCache.clear();
    this.log("Settings cache cleared");
  }
}
