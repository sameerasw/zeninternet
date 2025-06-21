/**
 * Tab Handler for Zen Internet extension
 * Handles tab-related events and management
 */

import { BaseService } from "../../shared/services/base-service.js";

export class TabHandler extends BaseService {
  constructor(styleService, iconService, settingsManager) {
    super("TabHandler");
    this.styleService = styleService;
    this.iconService = iconService;
    this.settingsManager = settingsManager;

    this.initializeEventListeners();
  }

  /**
   * Initializes tab event listeners
   */
  initializeEventListeners() {
    // Listen for tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Listen for tab activation
    browser.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    // Listen for tab removal
    browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.handleTabRemoved(tabId, removeInfo);
    });

    // Listen for tab replacement (for prerendered tabs)
    browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
      this.handleTabReplaced(addedTabId, removedTabId);
    });

    this.log("Tab event listeners initialized");
  }

  /**
   * Handles tab updated events
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change information
   * @param {Object} tab - Tab object
   */
  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      // Only process when the tab is complete
      if (changeInfo.status === "complete") {
        this.log(`Tab ${tabId} completed loading: ${tab.url}`);

        // Update icon for the tab
        await this.iconService.updateIconForTab(tabId, tab.url, (hostname) =>
          this.settingsManager.shouldApplyStyling(hostname)
        );

        // Apply styles if needed (this might be redundant with navigation handler)
        await this.styleService.applyCSSToTab(tab);
      }

      // Handle URL changes
      if (changeInfo.url) {
        this.log(`Tab ${tabId} URL changed to: ${changeInfo.url}`);

        // Clear any cached style info for this tab since URL changed
        this.styleService.clearTabStyleInfo(tabId);

        // Update icon immediately for new URL
        await this.iconService.updateIconForTab(
          tabId,
          changeInfo.url,
          (hostname) => this.settingsManager.shouldApplyStyling(hostname)
        );
      }
    } catch (error) {
      this.logError(`Error handling tab update for tab ${tabId}`, error);
    }
  }

  /**
   * Handles tab activated events
   * @param {Object} activeInfo - Active tab information
   */
  async handleTabActivated(activeInfo) {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);

      this.log(`Tab ${activeInfo.tabId} activated: ${tab.url}`);

      // Update icon for the activated tab
      await this.iconService.updateIconForTab(
        activeInfo.tabId,
        tab.url,
        (hostname) => this.settingsManager.shouldApplyStyling(hostname)
      );
    } catch (error) {
      this.logError(
        `Error handling tab activation for tab ${activeInfo.tabId}`,
        error
      );
    }
  }

  /**
   * Handles tab removed events
   * @param {number} tabId - Tab ID
   * @param {Object} removeInfo - Remove information
   */
  handleTabRemoved(tabId, removeInfo) {
    try {
      this.log(`Tab ${tabId} removed`);

      // Clean up any cached data for this tab
      this.styleService.clearTabStyleInfo(tabId);
      this.iconService.removeTabState(tabId);
    } catch (error) {
      this.logError(`Error handling tab removal for tab ${tabId}`, error);
    }
  }

  /**
   * Handles tab replaced events (prerendered tabs)
   * @param {number} addedTabId - New tab ID
   * @param {number} removedTabId - Old tab ID
   */
  async handleTabReplaced(addedTabId, removedTabId) {
    try {
      this.log(`Tab ${removedTabId} replaced with tab ${addedTabId}`);

      // Clean up old tab data
      this.styleService.clearTabStyleInfo(removedTabId);
      this.iconService.removeTabState(removedTabId);

      // Initialize new tab
      const tab = await browser.tabs.get(addedTabId);
      await this.styleService.applyCSSToTab(tab);
      await this.iconService.updateIconForTab(addedTabId, tab.url, (hostname) =>
        this.settingsManager.shouldApplyStyling(hostname)
      );
    } catch (error) {
      this.logError(
        `Error handling tab replacement (${removedTabId} -> ${addedTabId})`,
        error
      );
    }
  }

  /**
   * Refreshes all tabs with current settings
   * @returns {Promise<number>} - Number of tabs refreshed
   */
  async refreshAllTabs() {
    try {
      const tabs = await browser.tabs.query({});
      let refreshedCount = 0;

      for (const tab of tabs) {
        try {
          // Apply styles
          const styleSuccess = await this.styleService.applyCSSToTab(tab);

          // Update icon
          await this.iconService.updateIconForTab(tab.id, tab.url, (hostname) =>
            this.settingsManager.shouldApplyStyling(hostname)
          );

          if (styleSuccess) {
            refreshedCount++;
          }
        } catch (error) {
          this.logError(`Error refreshing tab ${tab.id}`, error);
        }
      }

      this.log(`Refreshed ${refreshedCount} out of ${tabs.length} tabs`);
      return refreshedCount;
    } catch (error) {
      this.logError("Error refreshing all tabs", error);
      return 0;
    }
  }

  /**
   * Gets information about all tabs
   * @returns {Promise<Object[]>} - Array of tab information
   */
  async getAllTabsInfo() {
    try {
      const tabs = await browser.tabs.query({});

      return tabs.map((tab) => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        windowId: tab.windowId,
        styleInfo: this.styleService.getActiveStyleInfo(tab.id),
        iconState: this.iconService.getIconState(tab.id),
      }));
    } catch (error) {
      this.logError("Error getting all tabs info", error);
      return [];
    }
  }

  /**
   * Gets tab statistics
   * @returns {Promise<Object>} - Tab statistics
   */
  async getTabStats() {
    try {
      const tabs = await browser.tabs.query({});
      const tabsInfo = await this.getAllTabsInfo();

      const styledTabs = tabsInfo.filter((tab) => tab.styleInfo).length;
      const activeTabs = tabsInfo.filter((tab) => tab.active).length;
      const httpTabs = tabsInfo.filter(
        (tab) => tab.url && tab.url.startsWith("http")
      ).length;

      return {
        totalTabs: tabs.length,
        styledTabs,
        activeTabs,
        httpTabs,
        nonHttpTabs: tabs.length - httpTabs,
      };
    } catch (error) {
      this.logError("Error getting tab stats", error);
      return {
        totalTabs: 0,
        styledTabs: 0,
        activeTabs: 0,
        httpTabs: 0,
        nonHttpTabs: 0,
      };
    }
  }

  /**
   * Applies styles to a specific tab by ID
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  async refreshTab(tabId) {
    try {
      const tab = await browser.tabs.get(tabId);
      const success = await this.styleService.applyCSSToTab(tab);

      await this.iconService.updateIconForTab(tabId, tab.url, (hostname) =>
        this.settingsManager.shouldApplyStyling(hostname)
      );

      this.log(`Refreshed tab ${tabId}: ${success ? "success" : "failed"}`);
      return success;
    } catch (error) {
      this.logError(`Error refreshing tab ${tabId}`, error);
      return false;
    }
  }
}
