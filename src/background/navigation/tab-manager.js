/**
 * Tab manager for handling tab events and navigation
 */

import { iconManager } from "./icon-manager.js";
import { styleApplier } from "../styling/style-applier.js";

/**
 * Tab Manager class for handling tab-related operations
 */
export class TabManager {
  constructor() {
    this.activeTabs = new Map();
    this.logging = true;
  }

  /**
   * Initialize tab event listeners
   */
  initializeListeners() {
    // Listen for navigation events
    browser.webNavigation.onBeforeNavigate.addListener((details) => {
      this.handleBeforeNavigate(details);
    });

    browser.webNavigation.onCommitted.addListener((details) => {
      this.handleNavigationCommitted(details);
    });

    // Listen for tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Listen for tab activation
    browser.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    // Listen for tab removal
    browser.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    if (this.logging) {
      console.log("DEBUG: Tab manager listeners initialized");
    }
  }

  /**
   * Handle before navigate event
   * @param {Object} details - Navigation details
   */
  handleBeforeNavigate(details) {
    if (details.frameId === 0) {
      // Only for main frame
      // Track active navigations
      this.activeTabs.set(details.tabId, details.url);

      // Pre-fetch any styling needed for this URL
      this.prepareStylesForNavigation(details.url, details.tabId);

      // Update icon for this tab
      iconManager.updateIconForTab(details.tabId, details.url);

      if (this.logging) {
        console.log(
          `DEBUG: Before navigate - Tab ${details.tabId}: ${details.url}`
        );
      }
    }
  }

  /**
   * Handle navigation committed event
   * @param {Object} details - Navigation details
   */
  handleNavigationCommitted(details) {
    if (details.frameId === 0) {
      // Only for main frame
      // Apply styles to the newly navigated page
      this.applyStylesOnCommit(details.tabId, details.url);

      if (this.logging) {
        console.log(
          `DEBUG: Navigation committed - Tab ${details.tabId}: ${details.url}`
        );
      }
    }
  }

  /**
   * Handle tab updated event
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change information
   * @param {Object} tab - Tab object
   */
  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === "complete" && tab.url) {
      // Update icon when tab loading is complete
      iconManager.updateIconForTab(tabId, tab.url);

      // Apply styles if needed
      if (tab.url.startsWith("http")) {
        styleApplier.applyCSSToTab(tab);
      }

      if (this.logging) {
        console.log(`DEBUG: Tab updated - Tab ${tabId} completed loading`);
      }
    }
  }

  /**
   * Handle tab activated event
   * @param {Object} activeInfo - Active tab information
   */
  async handleTabActivated(activeInfo) {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);

      if (tab.url && tab.url.startsWith("http")) {
        iconManager.updateIconForTab(activeInfo.tabId, tab.url);
      } else {
        iconManager.setDefaultIcon(activeInfo.tabId);
      }

      if (this.logging) {
        console.log(`DEBUG: Tab activated - Tab ${activeInfo.tabId}`);
      }
    } catch (error) {
      console.error("Error handling tab activation:", error);
    }
  }

  /**
   * Handle tab removed event
   * @param {number} tabId - Tab ID
   */
  handleTabRemoved(tabId) {
    // Clean up tab tracking
    this.activeTabs.delete(tabId);

    if (this.logging) {
      console.log(`DEBUG: Tab removed - Tab ${tabId}`);
    }
  }

  /**
   * Prepare styles for navigation
   * @param {string} url - URL being navigated to
   * @param {number} tabId - Tab ID
   */
  async prepareStylesForNavigation(url, tabId) {
    try {
      if (!url.startsWith("http")) {
        return;
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Import modules here to avoid circular dependencies
      const { settingsManager } = await import("../core/settings-manager.js");
      const { cssProcessor } = await import("../styling/css-processor.js");

      const settings = await settingsManager.getGlobalSettings();

      if (!settings.enableStyling) {
        return;
      }

      // Pre-fetch CSS for this hostname
      const css = await cssProcessor.getStylesForHostname(hostname, settings);

      if (css && tabId) {
        // Pre-inject CSS if possible
        try {
          await browser.tabs.insertCSS(tabId, {
            code: css,
            runAt: "document_start",
          });
        } catch (error) {
          // Ignore errors - tab might not be ready yet
          if (this.logging) {
            console.log(`DEBUG: Could not pre-inject CSS for tab ${tabId}`);
          }
        }
      }
    } catch (error) {
      console.error("Error preparing styles for navigation:", error);
    }
  }

  /**
   * Apply styles when navigation is committed
   * @param {number} tabId - Tab ID
   * @param {string} url - Tab URL
   */
  async applyStylesOnCommit(tabId, url) {
    try {
      if (!url.startsWith("http")) {
        return;
      }

      const tab = { id: tabId, url: url };
      await styleApplier.applyCSSToTab(tab);
    } catch (error) {
      console.error("Error applying styles on navigation commit:", error);
    }
  }

  /**
   * Get active tab information
   * @param {number} tabId - Tab ID
   * @returns {string|null} - Tab URL or null
   */
  getActiveTabUrl(tabId) {
    return this.activeTabs.get(tabId) || null;
  }

  /**
   * Update all active tab icons
   */
  async updateAllTabIcons() {
    await iconManager.updateAllTabIcons();
  }

  /**
   * Clear all tab tracking data
   */
  clearTabData() {
    this.activeTabs.clear();
  }
}

// Export singleton instance
export const tabManager = new TabManager();
