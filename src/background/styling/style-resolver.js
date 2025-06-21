/**
 * Style resolver for determining styling rules and policies
 */

import {
  normalizeHostname,
  matchesHostnamePattern,
} from "../../shared/utils/hostname-utils.js";
import { settingsManager } from "./settings-manager.js";
import { cacheManager } from "./cache-manager.js";
import { STORAGE_KEYS } from "../../shared/utils/storage-utils.js";

/**
 * Style Resolver class for determining styling rules
 */
export class StyleResolver {
  constructor() {
    this.logging = true;
  }

  /**
   * Enhanced function to determine styling state with detailed information
   * @param {string} hostname - Hostname to check
   * @returns {Promise<Object>} - Styling state information
   */
  async shouldApplyStyling(hostname) {
    try {
      // Check cache first
      const cachedState = cacheManager.getStylingState(hostname);
      if (cachedState) {
        return cachedState;
      }

      const normalizedHostname = normalizeHostname(hostname);
      const settings = await settingsManager.getGlobalSettings();

      // If styling is globally disabled, return no styling at all
      if (!settings.enableStyling) {
        const result = {
          shouldApply: false,
          reason: "globally_disabled",
        };
        cacheManager.setStylingState(hostname, result);
        return result;
      }

      // Check if we have a specific style for this site
      const hasSpecificStyle = await this.hasSpecificStyleForSite(
        normalizedHostname
      );

      // If we have a specific style, check blacklist/whitelist for regular styling
      if (hasSpecificStyle) {
        const skipStyleList = await settingsManager.getSkipList(
          STORAGE_KEYS.SKIP_THEMING
        );
        const styleMode = settings.whitelistStyleMode || false;

        if (styleMode) {
          // Whitelist mode: only apply if site is in the list
          if (skipStyleList.includes(normalizedHostname)) {
            const result = {
              shouldApply: true,
              reason: "whitelist_enabled",
              hasSpecificStyle: true,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          } else {
            const result = {
              shouldApply: false,
              reason: "whitelist_not_included",
              hasSpecificStyle: true,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          }
        } else {
          // Blacklist mode: apply unless site is in the list
          if (skipStyleList.includes(normalizedHostname)) {
            const result = {
              shouldApply: false,
              reason: "blacklist_skipped",
              hasSpecificStyle: true,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          } else {
            const result = {
              shouldApply: true,
              reason: "specific_theme_available",
              hasSpecificStyle: true,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          }
        }
      }

      // If no specific style, check if we should apply forced styling
      if (settings.forceStyling) {
        const skipForceList = await settingsManager.getSkipList(
          STORAGE_KEYS.SKIP_FORCE_THEMING
        );
        const isWhitelistMode = settings.whitelistMode || false;

        if (isWhitelistMode) {
          // Whitelist mode: only apply if site is in the list
          if (skipForceList.includes(normalizedHostname)) {
            const result = {
              shouldApply: true,
              reason: "forced_whitelist_enabled",
              hasSpecificStyle: false,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          } else {
            const result = {
              shouldApply: false,
              reason: "forced_whitelist_not_included",
              hasSpecificStyle: false,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          }
        } else {
          // Blacklist mode: apply unless site is in the list
          if (skipForceList.includes(normalizedHostname)) {
            const result = {
              shouldApply: false,
              reason: "forced_blacklist_skipped",
              hasSpecificStyle: false,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          } else {
            const result = {
              shouldApply: true,
              reason: "forced_styling_enabled",
              hasSpecificStyle: false,
            };
            cacheManager.setStylingState(hostname, result);
            return result;
          }
        }
      }

      // No styling applies
      const result = {
        shouldApply: false,
        reason: "no_styling_rules",
        hasSpecificStyle: false,
      };
      cacheManager.setStylingState(hostname, result);
      return result;
    } catch (error) {
      console.error("Error determining styling state:", error);
      return { shouldApply: false, reason: "error" };
    }
  }

  /**
   * Check if a site has specific styling available
   * @param {string} hostname - Normalized hostname
   * @returns {Promise<boolean>} - Whether site has specific styling
   */
  async hasSpecificStyleForSite(hostname) {
    // Check cache first
    if (
      cacheManager.hasCss(hostname) ||
      cacheManager.hasCss(`www.${hostname}`)
    ) {
      return true;
    }

    // Check for wildcard and TLD matches in cache
    for (const cachedSite of cacheManager.cssCache.keys()) {
      if (matchesHostnamePattern(hostname, cachedSite)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get styling mode description
   * @param {Object} settings - Global settings
   * @returns {Object} - Mode descriptions
   */
  getStylingModeDescription(settings) {
    return {
      forceMode: settings.whitelistMode ? "whitelist" : "blacklist",
      styleMode: settings.whitelistStyleMode ? "whitelist" : "blacklist",
      forcingEnabled: settings.forceStyling,
      stylingEnabled: settings.enableStyling,
    };
  }

  /**
   * Determine if fallback background should be applied
   * @param {string} hostname - Hostname to check
   * @returns {Promise<boolean>} - Whether fallback background should be applied
   */
  async shouldApplyFallbackBackground(hostname) {
    try {
      const normalizedHostname = normalizeHostname(hostname);
      const fallbackList = await settingsManager.getSkipList(
        STORAGE_KEYS.FALLBACK_BACKGROUND
      );
      return fallbackList.includes(normalizedHostname);
    } catch (error) {
      console.error("Error checking fallback background:", error);
      return false;
    }
  }

  /**
   * Get comprehensive styling decision for a hostname
   * @param {string} hostname - Hostname to analyze
   * @returns {Promise<Object>} - Comprehensive styling decision
   */
  async getComprehensiveStylingDecision(hostname) {
    try {
      const stylingDecision = await this.shouldApplyStyling(hostname);
      const fallbackBackground = await this.shouldApplyFallbackBackground(
        hostname
      );
      const settings = await settingsManager.getGlobalSettings();

      return {
        ...stylingDecision,
        fallbackBackground,
        settings: this.getStylingModeDescription(settings),
        hostname: normalizeHostname(hostname),
      };
    } catch (error) {
      console.error("Error getting comprehensive styling decision:", error);
      return {
        shouldApply: false,
        reason: "error",
        fallbackBackground: false,
        hostname: normalizeHostname(hostname),
      };
    }
  }
}

// Export singleton instance
export const styleResolver = new StyleResolver();
