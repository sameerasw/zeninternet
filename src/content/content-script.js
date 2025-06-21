/**
 * Content script - entry point for content script functionality
 */

import { domUtils } from "./dom-utils.js";

/**
 * Content Script class for handling content script operations
 */
class ContentScript {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize content script
   */
  async initialize() {
    try {
      if (this.initialized) {
        return;
      }

      // Wait for DOM to be ready
      await domUtils.waitForDOM();

      // Set up message listeners
      this.setupMessageListeners();

      // Announce readiness to background script
      await this.announceReady();

      this.initialized = true;
      console.log("ZenInternet: Content script initialized");
    } catch (error) {
      console.error("ZenInternet: Error initializing content script:", error);
    }
  }

  /**
   * Set up message listeners
   */
  setupMessageListeners() {
    browser.runtime.onMessage.addListener((message) => {
      return this.handleMessage(message);
    });
  }

  /**
   * Handle messages from background script
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Response object
   */
  async handleMessage(message) {
    try {
      switch (message.action) {
        case "applyStyles":
          return await this.handleApplyStyles(message);

        case "removeStyles":
          return await this.handleRemoveStyles();

        case "getPageInfo":
          return await this.handleGetPageInfo();

        default:
          console.log("ZenInternet: Unknown message action:", message.action);
          return { error: "Unknown action" };
      }
    } catch (error) {
      console.error("ZenInternet: Error handling message:", error);
      return { error: error.message };
    }
  }

  /**
   * Handle apply styles message
   * @param {Object} message - Message with CSS data
   * @returns {Promise<Object>} - Response object
   */
  async handleApplyStyles(message) {
    try {
      domUtils.updateStyles(message.css);
      return { success: true };
    } catch (error) {
      console.error("ZenInternet: Error applying styles:", error);
      return { error: error.message };
    }
  }

  /**
   * Handle remove styles message
   * @returns {Promise<Object>} - Response object
   */
  async handleRemoveStyles() {
    try {
      domUtils.removeStyles();
      return { success: true };
    } catch (error) {
      console.error("ZenInternet: Error removing styles:", error);
      return { error: error.message };
    }
  }

  /**
   * Handle get page info message
   * @returns {Promise<Object>} - Response object with page info
   */
  async handleGetPageInfo() {
    try {
      const pageInfo = domUtils.getPageInfo();
      return { success: true, pageInfo };
    } catch (error) {
      console.error("ZenInternet: Error getting page info:", error);
      return { error: error.message };
    }
  }

  /**
   * Announce content script readiness to background script
   */
  async announceReady() {
    try {
      const pageInfo = domUtils.getPageInfo();

      await browser.runtime.sendMessage({
        action: "contentScriptReady",
        hostname: pageInfo.hostname,
        pageInfo: pageInfo,
      });

      console.log("ZenInternet: Announced readiness to background script");
    } catch (error) {
      // Silent fail - background script might not be ready yet
      console.log("ZenInternet: Could not announce ready state");
    }
  }

  /**
   * Check if styles are currently applied
   * @returns {boolean} - Whether styles are applied
   */
  areStylesApplied() {
    return domUtils.hasStylesheet();
  }

  /**
   * Get current applied styles
   * @returns {string} - Current CSS content
   */
  getCurrentStyles() {
    return domUtils.getCurrentStyles();
  }

  /**
   * Cleanup content script resources
   */
  cleanup() {
    domUtils.removeStyles();
    console.log("ZenInternet: Content script cleaned up");
  }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.initialize();
