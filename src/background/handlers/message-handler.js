/**
 * Message Handler for Zen Internet extension
 * Handles runtime messages between components
 */

import { BaseService } from "../../shared/services/base-service.js";
import { MESSAGE_TYPES } from "../../shared/constants.js";

export class MessageHandler extends BaseService {
  constructor(styleService, iconService, autoUpdateService) {
    super("MessageHandler");
    this.styleService = styleService;
    this.iconService = iconService;
    this.autoUpdateService = autoUpdateService;

    this.initializeMessageListener();
  }

  /**
   * Initializes the runtime message listener
   */
  initializeMessageListener() {
    browser.runtime.onMessage.addListener((message, sender) => {
      return this.handleMessage(message, sender);
    });

    this.log("Message listener initialized");
  }

  /**
   * Handles incoming runtime messages
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @returns {Promise<any>} - Response or false for no response
   */
  async handleMessage(message, sender) {
    try {
      this.log(`Received message: ${message.action}`, message);

      switch (message.action) {
        case MESSAGE_TYPES.CONTENT_SCRIPT_READY:
          return await this.handleContentScriptReady(message, sender);

        case MESSAGE_TYPES.ENABLE_AUTO_UPDATE:
          return await this.handleEnableAutoUpdate(message);

        case MESSAGE_TYPES.DISABLE_AUTO_UPDATE:
          return await this.handleDisableAutoUpdate(message);

        case "refreshStyles":
          return await this.handleRefreshStyles(sender);

        case "getStyleStats":
          return await this.handleGetStyleStats();

        case "clearCache":
          return await this.handleClearCache();

        default:
          this.logWarning(`Unknown message action: ${message.action}`);
          return false;
      }
    } catch (error) {
      this.logError("Error handling message", error);
      return { error: error.message };
    }
  }

  /**
   * Handles content script ready messages
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @returns {Promise<Object>} - Response object
   */
  async handleContentScriptReady(message, sender) {
    if (!message.hostname || !sender.tab) {
      return { success: false, error: "Missing hostname or tab info" };
    }

    try {
      // Apply CSS to the tab
      const success = await this.styleService.applyCSSToTab(sender.tab);

      // Update icon for the tab
      await this.iconService.updateIconForTab(
        sender.tab.id,
        sender.tab.url,
        async (hostname) => {
          // We need to get the settings manager through the style service
          // This is a temporary solution - ideally we'd inject the settings manager
          return { shouldApply: success };
        }
      );

      this.log(
        `Content script ready for ${message.hostname}, styling applied: ${success}`
      );

      return { success: true, stylingApplied: success };
    } catch (error) {
      this.logError("Error handling content script ready", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles enable auto-update messages
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Response object
   */
  async handleEnableAutoUpdate(message) {
    try {
      this.autoUpdateService.start();

      // Optionally trigger immediate update
      if (message.immediate) {
        await this.autoUpdateService.fetchStyles(true);
      }

      this.log("Auto-update enabled");
      return { success: true };
    } catch (error) {
      this.logError("Error enabling auto-update", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles disable auto-update messages
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Response object
   */
  async handleDisableAutoUpdate(message) {
    try {
      this.autoUpdateService.stop();
      this.log("Auto-update disabled");
      return { success: true };
    } catch (error) {
      this.logError("Error disabling auto-update", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles refresh styles messages
   * @param {Object} sender - Sender information
   * @returns {Promise<Object>} - Response object
   */
  async handleRefreshStyles(sender) {
    try {
      let refreshedCount = 0;

      if (sender.tab) {
        // Refresh specific tab
        const success = await this.styleService.refreshTabStyles(sender.tab.id);
        refreshedCount = success ? 1 : 0;
      } else {
        // Refresh all tabs
        refreshedCount = await this.styleService.refreshAllTabStyles();
      }

      this.log(`Refreshed styles for ${refreshedCount} tab(s)`);
      return { success: true, refreshedCount };
    } catch (error) {
      this.logError("Error refreshing styles", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles get style stats messages
   * @returns {Promise<Object>} - Response object with stats
   */
  async handleGetStyleStats() {
    try {
      const styleStats = this.styleService.getStyleStats();
      const autoUpdateStats = await this.autoUpdateService.getStats();
      const iconStats = this.iconService.getIconStats();

      return {
        success: true,
        stats: {
          styles: styleStats,
          autoUpdate: autoUpdateStats,
          icons: iconStats,
        },
      };
    } catch (error) {
      this.logError("Error getting style stats", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles clear cache messages
   * @returns {Promise<Object>} - Response object
   */
  async handleClearCache() {
    try {
      // Clear various caches
      this.styleService.clearAllStyleInfo();
      this.iconService.clearAllStates();

      this.log("All caches cleared");
      return { success: true };
    } catch (error) {
      this.logError("Error clearing cache", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sends a message to all content scripts
   * @param {Object} message - Message to send
   * @returns {Promise<boolean>} - Success status
   */
  async broadcastToContentScripts(message) {
    try {
      const tabs = await browser.tabs.query({});
      const promises = tabs.map((tab) =>
        browser.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs without content scripts
        })
      );

      await Promise.all(promises);
      this.log(`Broadcasted message to ${tabs.length} tabs`);
      return true;
    } catch (error) {
      this.logError("Error broadcasting to content scripts", error);
      return false;
    }
  }

  /**
   * Sends a message to a specific tab
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<any>} - Response from content script
   */
  async sendToTab(tabId, message) {
    try {
      const response = await browser.tabs.sendMessage(tabId, message);
      this.log(`Sent message to tab ${tabId}`, message);
      return response;
    } catch (error) {
      this.logError(`Error sending message to tab ${tabId}`, error);
      return null;
    }
  }
}
