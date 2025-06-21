/**
 * Background Script Entry Point for Zen Internet extension
 * Coordinates all background services and handlers
 */

import { StorageManager } from "./core/storage-manager.js";
import { SettingsManager } from "./core/settings-manager.js";
import { CSSManager } from "./core/css-manager.js";
import { IconService } from "./services/icon-service.js";
import { StyleService } from "./services/style-service.js";
import { AutoUpdateService } from "./services/auto-update-service.js";
import { NavigationHandler } from "./handlers/navigation-handler.js";
import { MessageHandler } from "./handlers/message-handler.js";
import { TabHandler } from "./handlers/tab-handler.js";
import { STORAGE_KEYS } from "../shared/constants.js";

class ZenInternetBackground {
  constructor() {
    this.logging = true;
    this.initialized = false;

    // Core managers
    this.storageManager = null;
    this.settingsManager = null;
    this.cssManager = null;

    // Services
    this.iconService = null;
    this.styleService = null;
    this.autoUpdateService = null;

    // Handlers
    this.navigationHandler = null;
    this.messageHandler = null;
    this.tabHandler = null;
  }

  /**
   * Initializes the background script
   */
  async initialize() {
    if (this.initialized) {
      this.log("Background script already initialized");
      return;
    }

    try {
      this.log("Initializing Zen Internet background script...");

      // Initialize core managers in order
      await this.initializeCoreManagers();

      // Initialize services
      await this.initializeServices();

      // Initialize handlers
      await this.initializeHandlers();

      // Initialize default settings and data
      await this.initializeDefaults();

      // Initialize auto-update
      await this.initializeAutoUpdate();

      // Initial tab icon updates
      await this.updateAllTabIcons();

      this.initialized = true;
      this.log("Zen Internet background script initialized successfully");
    } catch (error) {
      this.logError("Error initializing background script", error);
    }
  }

  /**
   * Initializes core managers
   */
  async initializeCoreManagers() {
    this.log("Initializing core managers...");

    // Storage manager (foundation)
    this.storageManager = new StorageManager();

    // Settings manager (depends on storage)
    this.settingsManager = new SettingsManager(this.storageManager);

    // CSS manager (depends on storage and settings)
    this.cssManager = new CSSManager(this.storageManager, this.settingsManager);

    // Update settings manager with CSS manager reference
    this.settingsManager.hasSpecificStyleForSite = (hostname) => {
      return this.cssManager.hasSpecificStyle(hostname);
    };

    this.log("Core managers initialized");
  }

  /**
   * Initializes services
   */
  async initializeServices() {
    this.log("Initializing services...");

    // Icon service
    this.iconService = new IconService();

    // Style service (depends on CSS and settings managers)
    this.styleService = new StyleService(this.cssManager, this.settingsManager);

    // Auto-update service (depends on storage and CSS managers)
    this.autoUpdateService = new AutoUpdateService(
      this.storageManager,
      this.cssManager
    );

    this.log("Services initialized");
  }

  /**
   * Initializes handlers
   */
  async initializeHandlers() {
    this.log("Initializing handlers...");

    // Navigation handler
    this.navigationHandler = new NavigationHandler(
      this.styleService,
      this.iconService,
      this.settingsManager
    );

    // Message handler
    this.messageHandler = new MessageHandler(
      this.styleService,
      this.iconService,
      this.autoUpdateService
    );

    // Tab handler
    this.tabHandler = new TabHandler(
      this.styleService,
      this.iconService,
      this.settingsManager
    );

    this.log("Handlers initialized");
  }

  /**
   * Initializes default settings and required data
   */
  async initializeDefaults() {
    this.log("Initializing defaults...");

    // Initialize default settings
    await this.settingsManager.initializeDefaultSettings();

    // Initialize empty lists if they don't exist
    const lists = [
      STORAGE_KEYS.SKIP_FORCE_THEMING,
      STORAGE_KEYS.SKIP_THEMING,
      STORAGE_KEYS.FALLBACK_BACKGROUND,
    ];

    for (const listKey of lists) {
      const list = await this.storageManager.getList(listKey);
      if (list.length === 0) {
        await this.storageManager.saveList(listKey, []);
      }
    }

    // Preload styles
    await this.cssManager.preloadStyles();

    this.log("Defaults initialized");
  }

  /**
   * Initializes auto-update service
   */
  async initializeAutoUpdate() {
    this.log("Initializing auto-update...");

    await this.autoUpdateService.initialize();

    this.log("Auto-update initialized");
  }

  /**
   * Updates icons for all tabs
   */
  async updateAllTabIcons() {
    this.log("Updating all tab icons...");

    await this.iconService.updateAllTabIcons((hostname) =>
      this.settingsManager.shouldApplyStyling(hostname)
    );

    this.log("All tab icons updated");
  }

  /**
   * Handles storage changes
   * @param {Object} changes - Storage changes
   * @param {string} areaName - Storage area name
   */
  async handleStorageChange(changes, areaName) {
    if (areaName !== "local") return;

    try {
      // Clear relevant caches when settings change
      if (changes[STORAGE_KEYS.BROWSER_STORAGE]) {
        this.settingsManager.clearCache();
        this.storageManager.clearCache();

        // Update all tab icons and styles
        await this.tabHandler.refreshAllTabs();

        this.log("Settings changed, refreshed all tabs");
      }

      // Preload styles when they change
      if (changes[STORAGE_KEYS.STYLES]) {
        await this.cssManager.preloadStyles();
        await this.tabHandler.refreshAllTabs();

        this.log("Styles changed, preloaded and refreshed all tabs");
      }

      // Handle list changes
      const listKeys = [
        STORAGE_KEYS.SKIP_FORCE_THEMING,
        STORAGE_KEYS.SKIP_THEMING,
        STORAGE_KEYS.FALLBACK_BACKGROUND,
      ];

      for (const listKey of listKeys) {
        if (changes[listKey]) {
          this.settingsManager.clearStyleCache();
          await this.updateAllTabIcons();
          this.log(`List ${listKey} changed, updated icons`);
          break;
        }
      }
    } catch (error) {
      this.logError("Error handling storage change", error);
    }
  }

  /**
   * Gets comprehensive extension statistics
   * @returns {Promise<Object>} - Extension statistics
   */
  async getExtensionStats() {
    try {
      const tabStats = await this.tabHandler.getTabStats();
      const styleStats = this.styleService.getStyleStats();
      const iconStats = this.iconService.getIconStats();
      const cssStats = this.cssManager.getCacheStats();
      const autoUpdateStats = await this.autoUpdateService.getStats();
      const navigationStats = this.navigationHandler.getNavigationStats();

      return {
        tabs: tabStats,
        styles: styleStats,
        icons: iconStats,
        css: cssStats,
        autoUpdate: autoUpdateStats,
        navigation: navigationStats,
        initialized: this.initialized,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logError("Error getting extension stats", error);
      return { error: error.message };
    }
  }

  /**
   * Performs cleanup operations
   */
  async cleanup() {
    this.log("Performing cleanup...");

    try {
      // Stop auto-update
      if (this.autoUpdateService) {
        this.autoUpdateService.stop();
      }

      // Clear various caches
      if (this.cssManager) {
        this.cssManager.clearCache();
      }

      if (this.settingsManager) {
        this.settingsManager.clearCache();
      }

      if (this.storageManager) {
        this.storageManager.clearCache();
      }

      if (this.styleService) {
        this.styleService.clearAllStyleInfo();
      }

      if (this.iconService) {
        this.iconService.clearAllStates();
      }

      if (this.navigationHandler) {
        this.navigationHandler.clearAllNavigationInfo();
      }

      this.log("Cleanup completed");
    } catch (error) {
      this.logError("Error during cleanup", error);
    }
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet Background] ${message}`, data);
      } else {
        console.log(`[ZenInternet Background] ${message}`);
      }
    }
  }

  /**
   * Logs an error message
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  logError(message, error = null) {
    if (error) {
      console.error(`[ZenInternet Background] ${message}`, error);
    } else {
      console.error(`[ZenInternet Background] ${message}`);
    }
  }
}

// Initialize the background script
const zenInternetBackground = new ZenInternetBackground();

// Initialize on startup
zenInternetBackground.initialize();

// Listen for storage changes
browser.storage.onChanged.addListener((changes, areaName) => {
  zenInternetBackground.handleStorageChange(changes, areaName);
});

// Cleanup on extension unload (for development)
if (typeof browser !== "undefined" && browser.runtime.onSuspend) {
  browser.runtime.onSuspend.addListener(() => {
    zenInternetBackground.cleanup();
  });
}

// Make available for debugging
if (typeof globalThis !== "undefined") {
  globalThis.zenInternetBackground = zenInternetBackground;
}
