/**
 * Content Script Entry Point for Zen Internet extension
 * Main content script that handles communication with background script
 */

import { StyleInjector } from "./style-injector.js";
import { MESSAGE_TYPES } from "../shared/constants.js";

class ZenInternetContentScript {
  constructor() {
    this.styleInjector = new StyleInjector();
    this.logging = true;
    this.initialized = false;
    this.hostname = window.location.hostname;

    this.initialize();
  }

  /**
   * Initializes the content script
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.log(`Initializing content script for ${this.hostname}`);

      // Set up message listener
      this.setupMessageListener();

      // Start stylesheet validation
      this.styleInjector.startValidationCheck();

      // Announce readiness to background script
      this.announceReady();

      this.initialized = true;
      this.log("Content script initialized successfully");
    } catch (error) {
      this.logError("Error initializing content script", error);
    }
  }

  /**
   * Sets up the message listener for background script communication
   */
  setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });

    this.log("Message listener set up");
  }

  /**
   * Handles messages from the background script
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @returns {Promise<boolean>|boolean} - Response or promise
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      this.log(`Received message: ${message.action}`, message);

      switch (message.action) {
        case MESSAGE_TYPES.APPLY_STYLES:
          return this.handleApplyStyles(message);

        case "getStyleInfo":
          return this.handleGetStyleInfo();

        case "validateStyles":
          return this.handleValidateStyles();

        case "ping":
          return this.handlePing();

        default:
          this.log(`Unknown message action: ${message.action}`);
          return false;
      }
    } catch (error) {
      this.logError("Error handling message", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles apply styles messages
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Response object
   */
  async handleApplyStyles(message) {
    try {
      const success = this.styleInjector.updateStyles(message.css);

      return {
        success,
        applied: success && message.css?.length > 0,
        cssLength: message.css?.length || 0,
        hostname: this.hostname,
      };
    } catch (error) {
      this.logError("Error applying styles", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles get style info messages
   * @returns {Object} - Style information
   */
  handleGetStyleInfo() {
    return {
      success: true,
      hasStyles: this.styleInjector.hasStyles(),
      cssLength: this.styleInjector.getCurrentCSS().length,
      hostname: this.hostname,
      url: window.location.href,
    };
  }

  /**
   * Handles validate styles messages
   * @returns {Object} - Validation result
   */
  handleValidateStyles() {
    const isValid = this.styleInjector.validateStylesheet();

    return {
      success: true,
      isValid,
      hasStyles: this.styleInjector.hasStyles(),
      hostname: this.hostname,
    };
  }

  /**
   * Handles ping messages (for connectivity testing)
   * @returns {Object} - Ping response
   */
  handlePing() {
    return {
      success: true,
      timestamp: Date.now(),
      hostname: this.hostname,
      url: window.location.href,
    };
  }

  /**
   * Announces readiness to the background script
   */
  async announceReady() {
    try {
      const response = await browser.runtime.sendMessage({
        action: MESSAGE_TYPES.CONTENT_SCRIPT_READY,
        hostname: this.hostname,
        url: window.location.href,
        timestamp: Date.now(),
      });

      if (response && response.success) {
        this.log(
          `Background script acknowledged readiness: styling applied = ${response.stylingApplied}`
        );
      } else {
        this.log("Background script did not acknowledge readiness");
      }
    } catch (error) {
      // This is expected if the background script isn't ready yet
      this.log(
        "Could not announce ready state (background script may not be ready)"
      );
    }
  }

  /**
   * Handles page visibility changes
   */
  handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      // Re-validate styles when page becomes visible
      this.styleInjector.validateStylesheet();
      this.log("Page became visible, validated styles");
    }
  }

  /**
   * Handles page navigation within the same document
   */
  handleNavigation() {
    const newHostname = window.location.hostname;

    if (newHostname !== this.hostname) {
      this.log(`Hostname changed from ${this.hostname} to ${newHostname}`);
      this.hostname = newHostname;

      // Remove current styles since hostname changed
      this.styleInjector.removeStyles();

      // Announce readiness for new hostname
      this.announceReady();
    }
  }

  /**
   * Sets up additional event listeners
   */
  setupEventListeners() {
    // Listen for page visibility changes
    document.addEventListener("visibilitychange", () => {
      this.handleVisibilityChange();
    });

    // Listen for navigation changes (single-page apps)
    window.addEventListener("popstate", () => {
      this.handleNavigation();
    });

    // Listen for potential URL changes via pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleNavigation(), 0);
    }.bind(this);

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleNavigation(), 0);
    }.bind(this);

    this.log("Additional event listeners set up");
  }

  /**
   * Gets comprehensive content script information
   * @returns {Object} - Content script information
   */
  getInfo() {
    return {
      initialized: this.initialized,
      hostname: this.hostname,
      url: window.location.href,
      hasStyles: this.styleInjector.hasStyles(),
      cssLength: this.styleInjector.getCurrentCSS().length,
      timestamp: Date.now(),
    };
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet Content] ${message}`, data);
      } else {
        console.log(`[ZenInternet Content] ${message}`);
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
      console.error(`[ZenInternet Content] ${message}`, error);
    } else {
      console.error(`[ZenInternet Content] ${message}`);
    }
  }
}

// Initialize the content script
const zenInternetContent = new ZenInternetContentScript();

// Set up additional event listeners
zenInternetContent.setupEventListeners();

// Make available for debugging
if (typeof globalThis !== "undefined") {
  globalThis.zenInternetContent = zenInternetContent;
}
