/**
 * Style applier for injecting CSS into tabs
 */

import { normalizeHostname } from "../../shared/utils/hostname-utils.js";
import { styleResolver } from "./style-resolver.js";
import { cssProcessor } from "./css-processor.js";

/**
 * Style Applier class for CSS injection and management
 */
export class StyleApplier {
  constructor() {
    this.logging = true;
  }

  /**
   * Apply CSS to a specific tab
   * @param {Object} tab - Browser tab object
   * @returns {Promise<boolean>} - Success status
   */
  async applyCSSToTab(tab) {
    if (this.logging) {
      console.log(
        "DEBUG: applyCSSToTab called for tab",
        tab.id,
        "URL:",
        tab.url
      );
    }

    try {
      const url = new URL(tab.url);
      const hostname = normalizeHostname(url.hostname);

      if (this.logging) {
        console.log("DEBUG: Processing hostname:", hostname);
      }

      // Get comprehensive styling decision
      const decision = await styleResolver.getComprehensiveStylingDecision(
        hostname
      );

      if (this.logging) {
        console.log("DEBUG: Styling decision:", decision);
      }

      // If global styling is disabled, skip everything (including fallback background)
      if (decision.reason === "globally_disabled") {
        if (this.logging) {
          console.log("DEBUG: Global styling disabled, skipping");
        }
        return false;
      }

      // If fallback background is enabled for this site, apply it
      if (decision.fallbackBackground) {
        await this.applyFallbackBackground(tab.id, hostname);
      }

      // If full styling should be applied, proceed with normal CSS application
      if (decision.shouldApply) {
        const success = await this.applyFullStyling(tab.id, hostname, decision);
        if (this.logging) {
          console.log(`DEBUG: Full styling applied for ${hostname}:`, success);
        }
        return success;
      }

      if (this.logging) {
        console.log(
          "DEBUG: No styling applied for:",
          hostname,
          "Reason:",
          decision.reason
        );
      }

      return false;
    } catch (error) {
      console.error("DEBUG ERROR: Error applying CSS:", error);
      return false;
    }
  }

  /**
   * Apply full styling to a tab
   * @param {number} tabId - Tab ID
   * @param {string} hostname - Hostname
   * @param {Object} decision - Styling decision object
   * @returns {Promise<boolean>} - Success status
   */
  async applyFullStyling(tabId, hostname, decision) {
    try {
      let css = "";

      if (decision.hasSpecificStyle) {
        // Get pre-made CSS for this site
        const styles = await browser.storage.local.get(["styles"]);
        const features = styles.styles?.website?.[hostname];

        if (features) {
          css = await cssProcessor.processCssFeatures(features, hostname);
        }
      } else {
        // Generate force styling CSS
        css = await cssProcessor.generateForceStyleCss(hostname);
      }

      if (css.trim()) {
        return await this.injectCSS(tabId, css);
      }

      return false;
    } catch (error) {
      console.error("Error applying full styling:", error);
      return false;
    }
  }

  /**
   * Apply fallback background to a tab
   * @param {number} tabId - Tab ID
   * @param {string} hostname - Hostname
   * @returns {Promise<boolean>} - Success status
   */
  async applyFallbackBackground(tabId, hostname) {
    try {
      const fallbackCSS = `
/* ZenInternet: Fallback background for ${hostname} */
html {
    background-color: light-dark(#fff, #111) !important;
}
`;

      return await this.injectCSS(tabId, fallbackCSS);
    } catch (error) {
      console.error("Error applying fallback background:", error);
      return false;
    }
  }

  /**
   * Inject CSS into a tab
   * @param {number} tabId - Tab ID
   * @param {string} css - CSS to inject
   * @returns {Promise<boolean>} - Success status
   */
  async injectCSS(tabId, css) {
    try {
      await browser.tabs.insertCSS(tabId, {
        code: css,
        runAt: "document_start",
      });

      if (this.logging) {
        console.log(`DEBUG: Successfully injected CSS into tab ${tabId}`);
      }

      return true;
    } catch (error) {
      console.error(`Error injecting CSS into tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Remove CSS from a tab
   * @param {number} tabId - Tab ID
   * @param {string} css - CSS to remove
   * @returns {Promise<boolean>} - Success status
   */
  async removeCSS(tabId, css) {
    try {
      await browser.tabs.removeCSS(tabId, {
        code: css,
      });

      if (this.logging) {
        console.log(`DEBUG: Successfully removed CSS from tab ${tabId}`);
      }

      return true;
    } catch (error) {
      console.error(`Error removing CSS from tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Send CSS to content script for injection
   * @param {number} tabId - Tab ID
   * @param {string} css - CSS to send
   * @returns {Promise<boolean>} - Success status
   */
  async sendCSSToContentScript(tabId, css) {
    try {
      await browser.tabs.sendMessage(tabId, {
        action: "applyStyles",
        css: css,
      });

      if (this.logging) {
        console.log(
          `DEBUG: Successfully sent CSS to content script in tab ${tabId}`
        );
      }

      return true;
    } catch (error) {
      console.error(
        `Error sending CSS to content script in tab ${tabId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Apply CSS using both injection methods
   * @param {number} tabId - Tab ID
   * @param {string} hostname - Hostname
   * @param {Object} features - CSS features
   * @returns {Promise<boolean>} - Success status
   */
  async applyCSSDualMethod(tabId, hostname, features) {
    try {
      const css = await cssProcessor.processCssFeatures(features, hostname);

      if (!css.trim()) {
        if (this.logging) {
          console.log(`DEBUG: No CSS to apply for ${hostname}`);
        }
        return false;
      }

      // Try injecting via browser API first (faster)
      const injectionSuccess = await this.injectCSS(tabId, css);

      // Also send to content script as backup
      const contentScriptSuccess = await this.sendCSSToContentScript(
        tabId,
        css
      );

      return injectionSuccess || contentScriptSuccess;
    } catch (error) {
      console.error("Error applying CSS with dual method:", error);
      return false;
    }
  }
}

// Export singleton instance
export const styleApplier = new StyleApplier();
