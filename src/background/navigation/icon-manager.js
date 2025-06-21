/**
 * Icon manager for browser action icon management
 */

import { ICON_STATES } from "../../shared/constants.js";

/**
 * Icon Manager class for managing browser action icons
 */
export class IconManager {
  constructor() {
    this.logging = true;
  }

  /**
   * Update the icon for a specific tab based on styling state
   * @param {number} tabId - Tab ID
   * @param {string} url - Tab URL
   * @returns {Promise<void>}
   */
  async updateIconForTab(tabId, url) {
    try {
      if (!url) {
        // Get URL from tab if not provided
        const tab = await browser.tabs.get(tabId);
        url = tab.url;
      }

      // Non-HTTP URLs don't get styling
      if (!url || !url.startsWith("http")) {
        this.setIcon(tabId, false);
        return;
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Import style resolver here to avoid circular dependency
      const { styleResolver } = await import("../styling/style-resolver.js");

      // Determine styling state
      const stylingState = await styleResolver.shouldApplyStyling(hostname);

      // Update the icon based on whether styling is enabled for this site
      this.setIcon(tabId, stylingState.shouldApply);

      if (this.logging) {
        console.log(
          `DEBUG: Icon updated for tab ${tabId} (${hostname}): ${stylingState.shouldApply}`
        );
      }
    } catch (error) {
      console.error("Error updating icon:", error);
      this.setIcon(tabId, false);
    }
  }

  /**
   * Set the icon to either on or off state
   * @param {number} tabId - Tab ID
   * @param {boolean} isEnabled - Whether styling is enabled
   */
  setIcon(tabId, isEnabled) {
    try {
      const iconSet = isEnabled ? ICON_STATES.ON : ICON_STATES.OFF;

      browser.browserAction.setIcon({
        path: iconSet,
        tabId: tabId,
      });

      if (this.logging) {
        console.log(
          `DEBUG: Icon set to ${isEnabled ? "ON" : "OFF"} for tab ${tabId}`
        );
      }
    } catch (error) {
      console.error(`Error setting icon for tab ${tabId}:`, error);
    }
  }

  /**
   * Update icons for all open tabs
   * @returns {Promise<void>}
   */
  async updateAllTabIcons() {
    try {
      const tabs = await browser.tabs.query({});

      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith("http")) {
          await this.updateIconForTab(tab.id, tab.url);
        }
      }

      if (this.logging) {
        console.log(`DEBUG: Updated icons for ${tabs.length} tabs`);
      }
    } catch (error) {
      console.error("Error updating all tab icons:", error);
    }
  }

  /**
   * Set default icon state for a tab
   * @param {number} tabId - Tab ID
   */
  setDefaultIcon(tabId) {
    this.setIcon(tabId, false);
  }

  /**
   * Set icon based on global styling state
   * @param {number} tabId - Tab ID
   * @param {boolean} globalEnabled - Whether global styling is enabled
   */
  setGlobalStateIcon(tabId, globalEnabled) {
    if (!globalEnabled) {
      this.setIcon(tabId, false);
      return;
    }

    // If global styling is enabled, check specific tab state
    this.updateIconForTab(tabId);
  }
}

// Export singleton instance
export const iconManager = new IconManager();
