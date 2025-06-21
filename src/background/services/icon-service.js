/**
 * Icon Service for Zen Internet extension
 * Manages browser action icon states
 */

import { BaseService } from "../../shared/services/base-service.js";
import { ICON_STATES } from "../../shared/constants.js";

export class IconService extends BaseService {
  constructor() {
    super("IconService");
    this.iconStates = new Map();
  }

  /**
   * Sets the icon for a specific tab
   * @param {number} tabId - Tab ID
   * @param {boolean} isEnabled - Whether styling is enabled
   */
  setIcon(tabId, isEnabled) {
    const iconSet = isEnabled ? ICON_STATES.ON : ICON_STATES.OFF;

    try {
      browser.browserAction.setIcon({
        path: iconSet,
        tabId: tabId,
      });

      this.iconStates.set(tabId, isEnabled);
      this.log(
        `Icon set for tab ${tabId}: ${isEnabled ? "enabled" : "disabled"}`
      );
    } catch (error) {
      this.logError(`Error setting icon for tab ${tabId}`, error);
    }
  }

  /**
   * Updates icon for a tab based on URL
   * @param {number} tabId - Tab ID
   * @param {string} url - Tab URL
   * @param {Function} shouldApplyStylingCallback - Callback to determine styling state
   */
  async updateIconForTab(tabId, url, shouldApplyStylingCallback) {
    try {
      if (!url) {
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

      // Determine styling state
      const stylingState = await shouldApplyStylingCallback(hostname);
      this.setIcon(tabId, stylingState.shouldApply);
    } catch (error) {
      this.logError(`Error updating icon for tab ${tabId}`, error);
      this.setIcon(tabId, false);
    }
  }

  /**
   * Updates icons for all tabs
   * @param {Function} shouldApplyStylingCallback - Callback to determine styling state
   */
  async updateAllTabIcons(shouldApplyStylingCallback) {
    try {
      const tabs = await browser.tabs.query({});

      for (const tab of tabs) {
        await this.updateIconForTab(
          tab.id,
          tab.url,
          shouldApplyStylingCallback
        );
      }

      this.log(`Updated icons for ${tabs.length} tabs`);
    } catch (error) {
      this.logError("Error updating all tab icons", error);
    }
  }

  /**
   * Gets the current icon state for a tab
   * @param {number} tabId - Tab ID
   * @returns {boolean|null} - Icon state or null if not set
   */
  getIconState(tabId) {
    return this.iconStates.get(tabId) || null;
  }

  /**
   * Removes icon state for a tab (when tab is closed)
   * @param {number} tabId - Tab ID
   */
  removeTabState(tabId) {
    if (this.iconStates.has(tabId)) {
      this.iconStates.delete(tabId);
      this.log(`Removed icon state for tab ${tabId}`);
    }
  }

  /**
   * Gets statistics about icon states
   * @returns {Object} - Icon state statistics
   */
  getIconStats() {
    const states = Array.from(this.iconStates.values());
    const enabled = states.filter((state) => state).length;
    const disabled = states.filter((state) => !state).length;

    return {
      total: states.length,
      enabled,
      disabled,
    };
  }

  /**
   * Clears all icon states
   */
  clearAllStates() {
    this.iconStates.clear();
    this.log("All icon states cleared");
  }
}
