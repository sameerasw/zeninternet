/**
 * Main background script - entry point for the extension
 * Orchestrates all background services and modules
 */

// Import core modules
import { settingsManager } from "./core/settings-manager.js";
import { cacheManager } from "./core/cache-manager.js";

// Import styling modules
import { styleResolver } from "./styling/style-resolver.js";
import { styleApplier } from "./styling/style-applier.js";
import { cssProcessor } from "./styling/css-processor.js";

// Import navigation modules
import { tabManager } from "./navigation/tab-manager.js";
import { iconManager } from "./navigation/icon-manager.js";

// Import updater module
import { autoUpdater } from "./updater/auto-updater.js";

// Import shared utilities
import { STORAGE_KEYS } from "../shared/utils/storage-utils.js";

/**
 * Main Background Service class that orchestrates all extension functionality
 */
class BackgroundService {
  constructor() {
    this.initialized = false;
    this.logging = true;
  }

  /**
   * Initialize the extension
   */
  async initialize() {
    try {
      if (this.initialized) {
        console.warn("Background service already initialized");
        return;
      }

      if (this.logging) {
        console.log("DEBUG: Initializing Zen Internet extension");
      }

      // Initialize settings with defaults
      await settingsManager.initializeDefaults();

      // Initialize skip lists if they don't exist
      await this.initializeSkipLists();

      // Preload and cache styles
      await cssProcessor.preloadStyles();

      // Initialize tab management
      tabManager.initializeListeners();

      // Initialize auto-updater
      await this.initializeAutoUpdater();

      // Update icons for all existing tabs
      await tabManager.updateAllTabIcons();

      // Set up message listeners
      this.setupMessageListeners();

      // Set up storage change listeners
      this.setupStorageListeners();

      this.initialized = true;

      if (this.logging) {
        console.log("DEBUG: Zen Internet extension initialized successfully");
      }
    } catch (error) {
      console.error("Error initializing extension:", error);
    }
  }

  /**
   * Initialize skip lists with empty arrays if they don't exist
   */
  async initializeSkipLists() {
    try {
      const lists = [
        STORAGE_KEYS.SKIP_FORCE_THEMING,
        STORAGE_KEYS.SKIP_THEMING,
        STORAGE_KEYS.FALLBACK_BACKGROUND,
      ];

      for (const listKey of lists) {
        const existingList = await settingsManager.getSkipList(listKey);
        if (existingList.length === 0) {
          await settingsManager.setSkipList(listKey, []);
        }
      }
    } catch (error) {
      console.error("Error initializing skip lists:", error);
    }
  }

  /**
   * Initialize auto-updater based on settings
   */
  async initializeAutoUpdater() {
    try {
      const settings = await settingsManager.getGlobalSettings();

      if (settings.autoUpdate) {
        await autoUpdater.start();
      }
    } catch (error) {
      console.error("Error initializing auto-updater:", error);
    }
  }

  /**
   * Set up runtime message listeners
   */
  setupMessageListeners() {
    browser.runtime.onMessage.addListener(async (message, sender) => {
      try {
        return await this.handleMessage(message, sender);
      } catch (error) {
        console.error("Error handling message:", error);
        return { error: error.message };
      }
    });
  }

  /**
   * Handle runtime messages
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @returns {Promise<Object>} - Response object
   */
  async handleMessage(message, sender) {
    switch (message.action) {
      case "contentScriptReady":
        return await this.handleContentScriptReady(message, sender);

      case "enableAutoUpdate":
        return await this.handleEnableAutoUpdate();

      case "disableAutoUpdate":
        return await this.handleDisableAutoUpdate();

      case "triggerUpdate":
        return await this.handleTriggerUpdate();

      case "getLastUpdateTime":
        return await this.handleGetLastUpdateTime();

      default:
        if (this.logging) {
          console.log("DEBUG: Unknown message action:", message.action);
        }
        return { error: "Unknown action" };
    }
  }

  /**
   * Handle content script ready message
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @returns {Promise<Object>} - Response object
   */
  async handleContentScriptReady(message, sender) {
    try {
      if (message.hostname && sender.tab) {
        // Apply styles to the tab
        await styleApplier.applyCSSToTab(sender.tab);

        // Update icon
        await iconManager.updateIconForTab(sender.tab.id, sender.tab.url);

        return { success: true };
      }

      return { error: "Missing hostname or tab information" };
    } catch (error) {
      console.error("Error handling content script ready:", error);
      return { error: error.message };
    }
  }

  /**
   * Handle enable auto-update message
   * @returns {Promise<Object>} - Response object
   */
  async handleEnableAutoUpdate() {
    try {
      await autoUpdater.enable();
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Handle disable auto-update message
   * @returns {Promise<Object>} - Response object
   */
  async handleDisableAutoUpdate() {
    try {
      await autoUpdater.disable();
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Handle trigger update message
   * @returns {Promise<Object>} - Response object
   */
  async handleTriggerUpdate() {
    try {
      const success = await autoUpdater.triggerManualUpdate();
      return { success };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Handle get last update time message
   * @returns {Promise<Object>} - Response object
   */
  async handleGetLastUpdateTime() {
    try {
      const lastUpdateTime = await autoUpdater.getLastUpdateTime();
      const formattedTime = await autoUpdater.getFormattedLastUpdateTime();

      return {
        lastUpdateTime,
        formattedTime,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Set up storage change listeners
   */
  setupStorageListeners() {
    browser.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChange(changes, areaName);
    });
  }

  /**
   * Handle storage changes
   * @param {Object} changes - Storage changes
   * @param {string} areaName - Storage area name
   */
  handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    // Clear caches when settings change
    if (
      changes[STORAGE_KEYS.BROWSER_STORAGE] ||
      changes[STORAGE_KEYS.SKIP_THEMING] ||
      changes[STORAGE_KEYS.SKIP_FORCE_THEMING] ||
      changes[STORAGE_KEYS.FALLBACK_BACKGROUND]
    ) {
      cacheManager.clearAll();
      settingsManager.clearCache();

      if (this.logging) {
        console.log("DEBUG: Cleared caches due to settings change");
      }
    }

    // Handle auto-update setting changes
    if (changes[STORAGE_KEYS.BROWSER_STORAGE]) {
      this.handleGlobalSettingsChange(changes[STORAGE_KEYS.BROWSER_STORAGE]);
    }

    // Handle styles changes
    if (changes.styles) {
      cssProcessor.preloadStyles();

      if (this.logging) {
        console.log("DEBUG: Reloaded styles due to storage change");
      }
    }
  }

  /**
   * Handle global settings changes
   * @param {Object} change - Settings change object
   */
  async handleGlobalSettingsChange(change) {
    try {
      const newSettings = change.newValue || {};
      const oldSettings = change.oldValue || {};

      // Handle auto-update toggle
      if (newSettings.autoUpdate !== oldSettings.autoUpdate) {
        if (newSettings.autoUpdate) {
          await autoUpdater.start();
        } else {
          autoUpdater.stop();
        }
      }

      // Update all tab icons if global styling was toggled
      if (newSettings.enableStyling !== oldSettings.enableStyling) {
        await tabManager.updateAllTabIcons();
      }
    } catch (error) {
      console.error("Error handling global settings change:", error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    autoUpdater.stop();
    cacheManager.clearAll();
    settingsManager.clearCache();
    tabManager.clearTabData();

    if (this.logging) {
      console.log("DEBUG: Background service cleaned up");
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
backgroundService.initialize();
