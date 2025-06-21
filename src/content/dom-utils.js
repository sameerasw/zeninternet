/**
 * DOM utilities for content script operations
 */

import { CSS_INJECTION_SETTINGS } from "../shared/constants.js";

/**
 * DOM Utilities class for content script DOM operations
 */
export class DomUtils {
  constructor() {
    this.stylesheetId = CSS_INJECTION_SETTINGS.STYLESHEET_ID;
  }

  /**
   * Create or get stylesheet element
   * @returns {HTMLStyleElement} - Stylesheet element
   */
  getStylesheet() {
    let stylesheet = document.getElementById(this.stylesheetId);

    if (!stylesheet) {
      stylesheet = document.createElement("style");
      stylesheet.id = this.stylesheetId;
      stylesheet.type = "text/css";
      document.head.appendChild(stylesheet);
    }

    return stylesheet;
  }

  /**
   * Update stylesheet content
   * @param {string} css - CSS content
   */
  updateStyles(css) {
    const stylesheet = this.getStylesheet();
    stylesheet.textContent = css || "";
    console.log("ZenInternet: Styles were " + (css ? "updated" : "removed"));
  }

  /**
   * Remove stylesheet
   */
  removeStyles() {
    const stylesheet = document.getElementById(this.stylesheetId);
    if (stylesheet) {
      stylesheet.remove();
      console.log("ZenInternet: Stylesheet removed");
    }
  }

  /**
   * Check if stylesheet exists
   * @returns {boolean} - Whether stylesheet exists
   */
  hasStylesheet() {
    return !!document.getElementById(this.stylesheetId);
  }

  /**
   * Get current stylesheet content
   * @returns {string} - Current CSS content
   */
  getCurrentStyles() {
    const stylesheet = document.getElementById(this.stylesheetId);
    return stylesheet ? stylesheet.textContent : "";
  }

  /**
   * Safely execute DOM operations
   * @param {Function} operation - DOM operation to execute
   * @returns {*} - Operation result
   */
  safeExecute(operation) {
    try {
      return operation();
    } catch (error) {
      console.error("ZenInternet DOM operation failed:", error);
      return null;
    }
  }

  /**
   * Wait for DOM to be ready
   * @returns {Promise<void>}
   */
  waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Observe DOM changes
   * @param {Function} callback - Callback for DOM changes
   * @returns {MutationObserver} - Mutation observer instance
   */
  observeChanges(callback) {
    const observer = new MutationObserver(callback);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return observer;
  }

  /**
   * Check if element exists
   * @param {string} selector - CSS selector
   * @returns {boolean} - Whether element exists
   */
  elementExists(selector) {
    return !!document.querySelector(selector);
  }

  /**
   * Get page information
   * @returns {Object} - Page information
   */
  getPageInfo() {
    return {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      title: document.title,
      url: window.location.href,
      readyState: document.readyState,
    };
  }
}

// Export singleton instance
export const domUtils = new DomUtils();
