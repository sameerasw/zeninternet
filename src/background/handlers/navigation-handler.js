/**
 * Navigation Handler for Zen Internet extension
 * Handles web navigation events
 */

import { BaseService } from "../../shared/services/base-service.js";
import { normalizeHostname } from "../../shared/utils/hostname-utils.js";

export class NavigationHandler extends BaseService {
  constructor(styleService, iconService, settingsManager) {
    super("NavigationHandler");
    this.styleService = styleService;
    this.iconService = iconService;
    this.settingsManager = settingsManager;
    this.activeTabs = new Map();

    this.initializeEventListeners();
  }

  /**
   * Initializes navigation event listeners
   */
  initializeEventListeners() {
    // Listen for navigation events
    browser.webNavigation.onBeforeNavigate.addListener((details) => {
      this.handleBeforeNavigate(details);
    });

    browser.webNavigation.onCommitted.addListener((details) => {
      this.handleNavigationCommitted(details);
    });

    browser.webNavigation.onCompleted.addListener((details) => {
      this.handleNavigationCompleted(details);
    });

    this.log("Navigation event listeners initialized");
  }

  /**
   * Handles before navigate events
   * @param {Object} details - Navigation details
   */
  async handleBeforeNavigate(details) {
    if (details.frameId !== 0) {
      return; // Only handle main frame
    }

    try {
      const url = new URL(details.url);
      const hostname = normalizeHostname(url.hostname);

      // Track active navigation
      this.activeTabs.set(details.tabId, {
        url: details.url,
        hostname,
        navigationStart: Date.now(),
      });

      // Pre-fetch styling information
      await this.styleService.prepareStylesForUrl(hostname, details.tabId);

      // Update icon early
      await this.iconService.updateIconForTab(
        details.tabId,
        details.url,
        (hostname) => this.settingsManager.shouldApplyStyling(hostname)
      );

      this.log(`Before navigate: ${hostname} (tab: ${details.tabId})`);
    } catch (error) {
      this.logError("Error in handleBeforeNavigate", error);
    }
  }

  /**
   * Handles navigation committed events
   * @param {Object} details - Navigation details
   */
  async handleNavigationCommitted(details) {
    if (details.frameId !== 0) {
      return; // Only handle main frame
    }

    try {
      const tabInfo = this.activeTabs.get(details.tabId);
      if (tabInfo) {
        tabInfo.navigationCommitted = Date.now();
      }

      // Apply CSS as early as possible
      const tab = await browser.tabs.get(details.tabId);
      await this.styleService.applyCSSToTab(tab);

      this.log(`Navigation committed: ${details.url} (tab: ${details.tabId})`);
    } catch (error) {
      this.logError("Error in handleNavigationCommitted", error);
    }
  }

  /**
   * Handles navigation completed events
   * @param {Object} details - Navigation details
   */
  async handleNavigationCompleted(details) {
    if (details.frameId !== 0) {
      return; // Only handle main frame
    }

    try {
      const tabInfo = this.activeTabs.get(details.tabId);
      if (tabInfo) {
        tabInfo.navigationCompleted = Date.now();

        const totalTime = tabInfo.navigationCompleted - tabInfo.navigationStart;
        this.log(
          `Navigation completed for ${tabInfo.hostname} in ${totalTime}ms`
        );
      }

      // Final icon update
      await this.iconService.updateIconForTab(
        details.tabId,
        details.url,
        (hostname) => this.settingsManager.shouldApplyStyling(hostname)
      );
    } catch (error) {
      this.logError("Error in handleNavigationCompleted", error);
    }
  }

  /**
   * Gets navigation info for a tab
   * @param {number} tabId - Tab ID
   * @returns {Object|null} - Navigation info or null
   */
  getTabNavigationInfo(tabId) {
    return this.activeTabs.get(tabId) || null;
  }

  /**
   * Clears navigation info for a tab
   * @param {number} tabId - Tab ID
   */
  clearTabNavigationInfo(tabId) {
    if (this.activeTabs.has(tabId)) {
      this.activeTabs.delete(tabId);
      this.log(`Cleared navigation info for tab ${tabId}`);
    }
  }

  /**
   * Gets navigation statistics
   * @returns {Object} - Navigation statistics
   */
  getNavigationStats() {
    const tabs = Array.from(this.activeTabs.values());
    const completedNavigations = tabs.filter((tab) => tab.navigationCompleted);

    const averageTime =
      completedNavigations.length > 0
        ? completedNavigations.reduce(
            (sum, tab) => sum + (tab.navigationCompleted - tab.navigationStart),
            0
          ) / completedNavigations.length
        : 0;

    return {
      activeTabs: tabs.length,
      completedNavigations: completedNavigations.length,
      averageNavigationTime: Math.round(averageTime),
    };
  }

  /**
   * Clears all navigation info
   */
  clearAllNavigationInfo() {
    this.activeTabs.clear();
    this.log("All navigation info cleared");
  }
}
