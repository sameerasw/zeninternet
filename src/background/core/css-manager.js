/**
 * CSS Manager for Zen Internet extension
 * Handles CSS caching, processing, and injection
 */

import { BaseService } from "../../shared/services/base-service.js";
import { STORAGE_KEYS, FEATURE_TYPES } from "../../shared/constants.js";
import {
  normalizeHostname,
  matchesPattern,
  findBestMatch,
} from "../../shared/utils/hostname-utils.js";

export class CSSManager extends BaseService {
  constructor(storageManager, settingsManager) {
    super("CSSManager");
    this.storageManager = storageManager;
    this.settingsManager = settingsManager;
    this.cssCache = new Map();
  }

  /**
   * Preloads styles from storage into cache
   */
  async preloadStyles() {
    try {
      const data = await this.storageManager.get([
        STORAGE_KEYS.STYLES,
        STORAGE_KEYS.BROWSER_STORAGE,
      ]);
      const settings = data[STORAGE_KEYS.BROWSER_STORAGE] || {};

      if (settings.enableStyling === false) {
        this.log("Styling disabled, skipping preload");
        return;
      }

      this.cssCache.clear();

      const styles = data[STORAGE_KEYS.STYLES];
      if (styles?.website) {
        for (const [website, features] of Object.entries(styles.website)) {
          const processedCSS = this.processWebsiteFeatures(features);
          this.cssCache.set(website, processedCSS);
        }
        this.log(
          `Preloaded styles for ${Object.keys(styles.website).length} websites`
        );
      }
    } catch (error) {
      this.logError("Error preloading styles", error);
    }
  }

  /**
   * Processes website features into CSS
   * @param {Object} features - Website features object
   * @returns {Object} - Processed CSS data
   */
  processWebsiteFeatures(features) {
    const processedFeatures = {};
    let totalCSS = "";

    for (const [featureName, css] of Object.entries(features)) {
      processedFeatures[featureName] = {
        css,
        type: this.categorizeFeature(featureName),
        length: css.length,
      };
      totalCSS += css + "\n";
    }

    return {
      features: processedFeatures,
      combinedCSS: totalCSS,
      featureCount: Object.keys(features).length,
    };
  }

  /**
   * Categorizes a feature by its name
   * @param {string} featureName - Name of the feature
   * @returns {string} - Feature category
   */
  categorizeFeature(featureName) {
    const lowerName = featureName.toLowerCase();

    if (lowerName.includes("transparency")) {
      return FEATURE_TYPES.TRANSPARENCY;
    } else if (lowerName.includes("hover")) {
      return FEATURE_TYPES.HOVER;
    } else if (lowerName.includes("footer")) {
      return FEATURE_TYPES.FOOTER;
    }

    return "general";
  }

  /**
   * Gets CSS for a hostname
   * @param {string} hostname - Hostname to get CSS for
   * @returns {Promise<string|null>} - CSS string or null
   */
  async getCSSForHostname(hostname) {
    const normalizedHostname = normalizeHostname(hostname);
    const settings = await this.settingsManager.getEffectiveSettings(hostname);

    // Check for exact match first
    if (this.cssCache.has(normalizedHostname)) {
      return await this.processCSS(
        normalizedHostname,
        this.cssCache.get(normalizedHostname),
        settings
      );
    } else if (this.cssCache.has(`www.${normalizedHostname}`)) {
      return await this.processCSS(
        `www.${normalizedHostname}`,
        this.cssCache.get(`www.${normalizedHostname}`),
        settings
      );
    }

    // Check for pattern matches
    const patterns = Array.from(this.cssCache.keys());
    const match = findBestMatch(normalizedHostname, patterns);

    if (match) {
      const cssData = this.cssCache.get(match.pattern);
      this.log(
        `Found ${match.matchType} match for ${hostname}: ${match.pattern}`
      );
      return await this.processCSS(match.pattern, cssData, settings);
    }

    return null;
  }

  /**
   * Processes CSS based on settings
   * @param {string} website - Website name
   * @param {Object} cssData - CSS data object
   * @param {Object} settings - Settings object
   * @returns {Promise<string>} - Processed CSS
   */
  async processCSS(website, cssData, settings) {
    let combinedCSS = "";
    let includedFeatures = 0;
    const skippedFeatures = {
      transparency: 0,
      hover: 0,
      footer: 0,
      disabled: 0,
    };

    for (const [featureName, featureData] of Object.entries(cssData.features)) {
      const featureType = featureData.type;
      const isFeatureEnabled = await this.isFeatureEnabled(
        featureName,
        featureType,
        settings
      );

      if (!isFeatureEnabled.enabled) {
        skippedFeatures[isFeatureEnabled.reason]++;
        this.log(`Skipping feature ${featureName}: ${isFeatureEnabled.reason}`);
        continue;
      }

      combinedCSS += featureData.css + "\n";
      includedFeatures++;
    }

    // Add fallback background if enabled
    if (settings.hasFallbackBackground) {
      combinedCSS += this.getFallbackBackgroundCSS();
      this.log(`Added fallback background for ${website}`);
    }

    this.log(
      `CSS processing for ${website}: ${includedFeatures} included, ${Object.values(
        skippedFeatures
      ).reduce((a, b) => a + b, 0)} skipped`
    );

    return combinedCSS.trim();
  }

  /**
   * Checks if a feature should be enabled
   * @param {string} featureName - Name of the feature
   * @param {string} featureType - Type of the feature
   * @param {Object} settings - Settings object
   * @returns {Promise<Object>} - Result with enabled status and reason
   */
  async isFeatureEnabled(featureName, featureType, settings) {
    // Check global feature toggles
    if (
      featureType === FEATURE_TYPES.TRANSPARENCY &&
      (settings.disableTransparency || settings.hasFallbackBackground)
    ) {
      return { enabled: false, reason: "transparency" };
    }

    if (featureType === FEATURE_TYPES.HOVER && settings.disableHover) {
      return { enabled: false, reason: "hover" };
    }

    if (featureType === FEATURE_TYPES.FOOTER && settings.disableFooter) {
      return { enabled: false, reason: "footer" };
    }

    // Check site-specific feature settings
    if (settings.siteSettings[featureName] === false) {
      return { enabled: false, reason: "disabled" };
    }

    return { enabled: true, reason: "enabled" };
  }

  /**
   * Gets fallback background CSS
   * @returns {string} - Fallback background CSS
   */
  getFallbackBackgroundCSS() {
    return `
/* ZenInternet: Fallback background */
html {
    background-color: light-dark(#fff, #111);
}
`;
  }

  /**
   * Checks if a hostname has specific styling
   * @param {string} hostname - Hostname to check
   * @returns {boolean} - Whether hostname has specific styling
   */
  hasSpecificStyle(hostname) {
    const normalizedHostname = normalizeHostname(hostname);

    // Check exact matches
    if (
      this.cssCache.has(normalizedHostname) ||
      this.cssCache.has(`www.${normalizedHostname}`)
    ) {
      return true;
    }

    // Check pattern matches
    const patterns = Array.from(this.cssCache.keys());
    return findBestMatch(normalizedHostname, patterns) !== null;
  }

  /**
   * Gets all cached websites
   * @returns {string[]} - Array of cached website names
   */
  getCachedWebsites() {
    return Array.from(this.cssCache.keys());
  }

  /**
   * Gets CSS cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const websites = Array.from(this.cssCache.keys());
    const totalFeatures = websites.reduce((total, website) => {
      return total + this.cssCache.get(website).featureCount;
    }, 0);

    return {
      websiteCount: websites.length,
      totalFeatures,
      cacheSize: this.cssCache.size,
    };
  }

  /**
   * Clears CSS cache
   */
  clearCache() {
    this.cssCache.clear();
    this.log("CSS cache cleared");
  }
}
