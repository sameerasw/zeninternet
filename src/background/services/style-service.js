/**
 * Style Service for Zen Internet extension
 * Handles CSS application and style management
 */

import { BaseService } from "../../shared/services/base-service.js";
import { MESSAGE_TYPES } from "../../shared/constants.js";

export class StyleService extends BaseService {
  constructor(cssManager, settingsManager) {
    super("StyleService");
    this.cssManager = cssManager;
    this.settingsManager = settingsManager;
    this.activeStyles = new Map();
  }

  /**
   * Applies CSS to a tab
   * @param {Object} tab - Tab object
   * @returns {Promise<boolean>} - Success status
   */
  async applyCSSToTab(tab) {
    try {
      if (!tab.url || !tab.url.startsWith("http")) {
        this.log(`Skipping non-HTTP URL: ${tab.url}`);
        return false;
      }

      const url = new URL(tab.url);
      const hostname = url.hostname;

      this.log(`Applying CSS to tab ${tab.id} for ${hostname}`);

      const stylingState = await this.settingsManager.shouldApplyStyling(
        hostname
      );
      const settings = await this.settingsManager.getEffectiveSettings(
        hostname
      );

      // Handle fallback background even if no other styling
      if (settings.hasFallbackBackground && !stylingState.shouldApply) {
        const fallbackCSS = this.cssManager.getFallbackBackgroundCSS();
        return await this.injectCSS(tab.id, fallbackCSS, "fallback-background");
      }

      // Apply full styling if determined
      if (stylingState.shouldApply) {
        const css = await this.cssManager.getCSSForHostname(hostname);
        if (css) {
          return await this.injectCSS(tab.id, css, "full-styling");
        }
      }

      this.log(`No styling applied to ${hostname}: ${stylingState.reason}`);
      return false;
    } catch (error) {
      this.logError(`Error applying CSS to tab ${tab.id}`, error);
      return false;
    }
  }

  /**
   * Injects CSS into a tab
   * @param {number} tabId - Tab ID
   * @param {string} css - CSS to inject
   * @param {string} type - Type of styling being applied
   * @returns {Promise<boolean>} - Success status
   */
  async injectCSS(tabId, css, type = "unknown") {
    try {
      // Send message to content script to apply styles
      await browser.tabs.sendMessage(tabId, {
        action: MESSAGE_TYPES.APPLY_STYLES,
        css: css,
      });

      this.activeStyles.set(tabId, {
        type,
        cssLength: css.length,
        appliedAt: Date.now(),
      });

      this.log(
        `Injected ${css.length} characters of CSS (${type}) to tab ${tabId}`
      );
      return true;
    } catch (error) {
      // If content script isn't ready, try direct injection
      try {
        await browser.tabs.insertCSS(tabId, {
          code: css,
          runAt: "document_start",
        });

        this.activeStyles.set(tabId, {
          type: `${type}-direct`,
          cssLength: css.length,
          appliedAt: Date.now(),
        });

        this.log(
          `Direct injected ${css.length} characters of CSS (${type}) to tab ${tabId}`
        );
        return true;
      } catch (directError) {
        this.logError(`Error injecting CSS to tab ${tabId}`, directError);
        return false;
      }
    }
  }

  /**
   * Removes CSS from a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeCSSFromTab(tabId) {
    try {
      // Send message to content script to remove styles
      await browser.tabs.sendMessage(tabId, {
        action: MESSAGE_TYPES.APPLY_STYLES,
        css: "",
      });

      if (this.activeStyles.has(tabId)) {
        this.activeStyles.delete(tabId);
      }

      this.log(`Removed CSS from tab ${tabId}`);
      return true;
    } catch (error) {
      this.logError(`Error removing CSS from tab ${tabId}`, error);
      return false;
    }
  }

  /**
   * Refreshes styles for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  async refreshTabStyles(tabId) {
    try {
      const tab = await browser.tabs.get(tabId);
      return await this.applyCSSToTab(tab);
    } catch (error) {
      this.logError(`Error refreshing styles for tab ${tabId}`, error);
      return false;
    }
  }

  /**
   * Refreshes styles for all tabs
   * @returns {Promise<number>} - Number of tabs refreshed
   */
  async refreshAllTabStyles() {
    try {
      const tabs = await browser.tabs.query({});
      let refreshedCount = 0;

      for (const tab of tabs) {
        const success = await this.applyCSSToTab(tab);
        if (success) refreshedCount++;
      }

      this.log(`Refreshed styles for ${refreshedCount}/${tabs.length} tabs`);
      return refreshedCount;
    } catch (error) {
      this.logError("Error refreshing all tab styles", error);
      return 0;
    }
  }

  /**
   * Prepares styles for a URL that's about to load
   * @param {string} hostname - Hostname to prepare styles for
   * @param {number} tabId - Tab ID
   */
  async prepareStylesForUrl(hostname, tabId) {
    try {
      const settings = await this.settingsManager.getEffectiveSettings(
        hostname
      );

      if (!settings.enableStyling) {
        this.log(`Styling disabled, skipping preparation for ${hostname}`);
        return;
      }

      const css = await this.cssManager.getCSSForHostname(hostname);

      if (css && tabId) {
        // Pre-cache the CSS for faster injection
        this.log(`Prepared ${css.length} characters of CSS for ${hostname}`);
      }
    } catch (error) {
      this.logError(`Error preparing styles for ${hostname}`, error);
    }
  }

  /**
   * Gets active style information for a tab
   * @param {number} tabId - Tab ID
   * @returns {Object|null} - Style information or null
   */
  getActiveStyleInfo(tabId) {
    return this.activeStyles.get(tabId) || null;
  }

  /**
   * Gets statistics about active styles
   * @returns {Object} - Style statistics
   */
  getStyleStats() {
    const styles = Array.from(this.activeStyles.values());
    const totalCSS = styles.reduce(
      (total, style) => total + style.cssLength,
      0
    );
    const typeStats = {};

    styles.forEach((style) => {
      typeStats[style.type] = (typeStats[style.type] || 0) + 1;
    });

    return {
      activeTabs: styles.length,
      totalCSSLength: totalCSS,
      typeBreakdown: typeStats,
    };
  }

  /**
   * Clears active style tracking for a tab
   * @param {number} tabId - Tab ID
   */
  clearTabStyleInfo(tabId) {
    if (this.activeStyles.has(tabId)) {
      this.activeStyles.delete(tabId);
      this.log(`Cleared style info for tab ${tabId}`);
    }
  }

  /**
   * Clears all active style tracking
   */
  clearAllStyleInfo() {
    this.activeStyles.clear();
    this.log("Cleared all style info");
  }
}
