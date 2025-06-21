/**
 * CSS processor for handling CSS compilation and processing
 */

import {
  normalizeHostname,
  matchesHostnamePattern,
} from "../../shared/utils/hostname-utils.js";
import { settingsManager } from "../core/settings-manager.js";
import { cacheManager } from "../core/cache-manager.js";
import { STORAGE_KEYS } from "../../shared/utils/storage-utils.js";

/**
 * CSS Processor class for handling CSS operations
 */
export class CssProcessor {
  constructor() {
    this.logging = true;
  }

  /**
   * Get appropriate styles for a hostname based on all rules
   * @param {string} hostname - Hostname to get styles for
   * @param {Object} settings - Global settings
   * @returns {Promise<string|null>} - CSS string or null
   */
  async getStylesForHostname(hostname, settings = null) {
    try {
      if (!settings) {
        settings = await settingsManager.getGlobalSettings();
      }

      if (this.logging) {
        console.log("DEBUG: Finding styles for hostname:", hostname);
      }

      // Check cache first
      const cachedCss = cacheManager.getCss(hostname);
      if (cachedCss) {
        if (this.logging) {
          console.log("DEBUG: Found cached CSS for hostname");
        }
        return cachedCss;
      }

      // Check for exact matches first (highest priority)
      const exactMatch = this.findExactMatch(hostname);
      if (exactMatch) {
        if (this.logging) {
          console.log("DEBUG: Found exact hostname match");
        }
        return exactMatch;
      }

      // Check for www variant
      const wwwMatch = this.findWwwMatch(hostname);
      if (wwwMatch) {
        if (this.logging) {
          console.log("DEBUG: Found www variant match");
        }
        return wwwMatch;
      }

      // Check for pattern matches (wildcards and TLD)
      const patternMatch = this.findPatternMatch(hostname);
      if (patternMatch) {
        if (this.logging) {
          console.log("DEBUG: Found pattern match");
        }
        return patternMatch;
      }

      return null;
    } catch (error) {
      console.error("Error getting styles for hostname:", error);
      return null;
    }
  }

  /**
   * Find exact hostname match in cache
   * @param {string} hostname - Hostname to find
   * @returns {string|null} - CSS or null
   */
  findExactMatch(hostname) {
    return cacheManager.getCss(hostname);
  }

  /**
   * Find www variant match
   * @param {string} hostname - Hostname to find
   * @returns {string|null} - CSS or null
   */
  findWwwMatch(hostname) {
    const wwwHostname = `www.${hostname}`;
    return cacheManager.getCss(wwwHostname);
  }

  /**
   * Find pattern match (wildcard or TLD)
   * @param {string} hostname - Hostname to find
   * @returns {string|null} - CSS or null
   */
  findPatternMatch(hostname) {
    const normalizedHostname = normalizeHostname(hostname);

    // Check all cached sites for pattern matches
    for (const [cachedSite, css] of cacheManager.cssCache.entries()) {
      if (matchesHostnamePattern(normalizedHostname, cachedSite)) {
        return css;
      }
    }

    return null;
  }

  /**
   * Process and combine CSS features
   * @param {Object} features - CSS features object
   * @param {string} hostname - Hostname for site-specific settings
   * @param {Object} globalSettings - Global settings
   * @returns {Promise<string>} - Combined CSS string
   */
  async processCssFeatures(features, hostname, globalSettings = null) {
    if (!features) {
      if (this.logging) {
        console.log("DEBUG: No features to process");
      }
      return "";
    }

    if (this.logging) {
      console.log("DEBUG: Processing features:", Object.keys(features).length);
    }

    if (!globalSettings) {
      globalSettings = await settingsManager.getGlobalSettings();
    }

    // Get site-specific settings
    const normalizedHostname = normalizeHostname(hostname);
    const siteSettings = await settingsManager.getSiteSettings(
      normalizedHostname
    );

    // Check if this site has fallback background enabled
    const fallbackList = await settingsManager.getSkipList(
      STORAGE_KEYS.FALLBACK_BACKGROUND
    );
    const hasFallbackBackground = fallbackList.includes(normalizedHostname);

    let combinedCSS = "";
    let stats = {
      includedFeatures: 0,
      skippedTransparencyFeatures: 0,
      skippedHoverFeatures: 0,
      skippedFooterFeatures: 0,
      skippedDisabledFeatures: 0,
    };

    for (const [feature, css] of Object.entries(features)) {
      const isTransparencyFeature = feature
        .toLowerCase()
        .includes("transparency");
      const isHoverFeature = feature.toLowerCase().includes("hover");
      const isFooterFeature = feature.toLowerCase().includes("footer");

      // Skip transparency if globally disabled OR if this site has fallback background enabled
      if (
        isTransparencyFeature &&
        (globalSettings.disableTransparency || hasFallbackBackground)
      ) {
        stats.skippedTransparencyFeatures++;
        if (this.logging) {
          console.log(`DEBUG: Skipping transparency feature: ${feature}`);
        }
        continue;
      }

      // Skip hover features if globally disabled
      if (isHoverFeature && globalSettings.disableHover) {
        stats.skippedHoverFeatures++;
        if (this.logging) {
          console.log(`DEBUG: Skipping hover feature: ${feature}`);
        }
        continue;
      }

      // Skip footer features if globally disabled
      if (isFooterFeature && globalSettings.disableFooter) {
        stats.skippedFooterFeatures++;
        if (this.logging) {
          console.log(`DEBUG: Skipping footer feature: ${feature}`);
        }
        continue;
      }

      // Check if this specific feature is disabled by site settings
      if (siteSettings[feature] === false) {
        stats.skippedDisabledFeatures++;
        if (this.logging) {
          console.log(`DEBUG: Skipping site-disabled feature: ${feature}`);
        }
        continue;
      }

      // Include this feature's CSS
      combinedCSS += css + "\n";
      stats.includedFeatures++;
      if (this.logging) {
        console.log(`DEBUG: Including feature: ${feature}`);
      }
    }

    // Add fallback background CSS if enabled for this site
    if (hasFallbackBackground) {
      if (this.logging) {
        console.log("DEBUG: Adding fallback background CSS");
      }
      const fallbackBackgroundCSS = `
/* ZenInternet: Fallback background for this site */
html{
    background-color: light-dark(#fff, #111);
}
`;
      combinedCSS += fallbackBackgroundCSS;
    }

    if (this.logging) {
      console.log(`DEBUG: CSS processing summary:`, stats);
      console.log(`DEBUG: Has fallback background: ${hasFallbackBackground}`);
      console.log(`DEBUG: Final CSS length: ${combinedCSS.length} characters`);
    }

    return combinedCSS.trim();
  }

  /**
   * Generate fallback/force styling CSS
   * @param {string} hostname - Hostname for context
   * @returns {Promise<string>} - Force styling CSS
   */
  async generateForceStyleCss(hostname) {
    try {
      const settings = await settingsManager.getGlobalSettings();

      let forceCSS = `
/* ZenInternet: Force styling for ${hostname} */
html, body {
    background: transparent !important;
}

/* Basic transparency for common containers */
.container, .wrapper, .main, .content, #main, #content {
    background: transparent !important;
}

/* Header and navigation transparency */
header, nav, .header, .nav, .navbar, .navigation {
    background: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(10px) !important;
}

/* Sidebar transparency */
.sidebar, .side-nav, aside {
    background: rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(5px) !important;
}
`;

      // Add footer styling unless disabled
      if (!settings.disableFooter) {
        forceCSS += `
/* Footer transparency */
footer, .footer {
    background: rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(5px) !important;
}
`;
      }

      return forceCSS;
    } catch (error) {
      console.error("Error generating force style CSS:", error);
      return "";
    }
  }

  /**
   * Preload and cache styles from storage
   * @returns {Promise<boolean>} - Success status
   */
  async preloadStyles() {
    try {
      const data = await browser.storage.local.get(["styles"]);

      if (!data.styles?.website) {
        if (this.logging) {
          console.log("DEBUG: No website styles found to preload");
        }
        return false;
      }

      const websites = data.styles.website;
      let preloadedCount = 0;

      for (const [hostname, features] of Object.entries(websites)) {
        if (features && typeof features === "object") {
          const css = await this.processCssFeatures(features, hostname);
          if (css) {
            cacheManager.setCss(hostname, css);
            preloadedCount++;
          }
        }
      }

      if (this.logging) {
        console.log(`DEBUG: Preloaded ${preloadedCount} website styles`);
      }

      return true;
    } catch (error) {
      console.error("Error preloading styles:", error);
      return false;
    }
  }

  /**
   * Clear all CSS caches
   */
  clearCache() {
    cacheManager.clearCssCache();
  }
}

// Export singleton instance
export const cssProcessor = new CssProcessor();
