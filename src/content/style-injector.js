/**
 * Style Injector for Zen Internet extension content script
 * Handles CSS injection and management in web pages
 */

import { CSS_INJECTION_SETTINGS, MESSAGE_TYPES } from "../shared/constants.js";

export class StyleInjector {
  constructor() {
    this.stylesheetId = CSS_INJECTION_SETTINGS.STYLESHEET_ID;
    this.currentCSS = "";
    this.logging = true;
  }

  /**
   * Creates or gets the stylesheet element
   * @returns {HTMLStyleElement} - The stylesheet element
   */
  getStylesheet() {
    let stylesheet = document.getElementById(this.stylesheetId);

    if (!stylesheet) {
      stylesheet = document.createElement("style");
      stylesheet.id = this.stylesheetId;
      stylesheet.type = "text/css";

      // Insert at the beginning of head for higher priority
      if (document.head.firstChild) {
        document.head.insertBefore(stylesheet, document.head.firstChild);
      } else {
        document.head.appendChild(stylesheet);
      }

      this.log("Created new stylesheet element");
    }

    return stylesheet;
  }

  /**
   * Updates the stylesheet content
   * @param {string} css - CSS content to apply
   * @returns {boolean} - Success status
   */
  updateStyles(css) {
    try {
      const stylesheet = this.getStylesheet();
      const sanitizedCSS = this.sanitizeCSS(css);

      stylesheet.textContent = sanitizedCSS || "";
      this.currentCSS = sanitizedCSS;

      this.log(
        `Styles ${css ? "updated" : "removed"} (${
          sanitizedCSS.length
        } characters)`
      );
      return true;
    } catch (error) {
      this.logError("Error updating styles", error);
      return false;
    }
  }

  /**
   * Removes all styles
   * @returns {boolean} - Success status
   */
  removeStyles() {
    return this.updateStyles("");
  }

  /**
   * Gets the current CSS content
   * @returns {string} - Current CSS content
   */
  getCurrentCSS() {
    return this.currentCSS;
  }

  /**
   * Checks if styles are currently applied
   * @returns {boolean} - Whether styles are applied
   */
  hasStyles() {
    return this.currentCSS.length > 0;
  }

  /**
   * Sanitizes CSS content (basic security measure)
   * @param {string} css - CSS to sanitize
   * @returns {string} - Sanitized CSS
   */
  sanitizeCSS(css) {
    if (!css || typeof css !== "string") {
      return "";
    }

    // Remove any potential script injections
    return css
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/expression\s*\(/gi, "");
  }

  /**
   * Validates that the stylesheet is still properly attached
   * @returns {boolean} - Whether stylesheet is properly attached
   */
  validateStylesheet() {
    const stylesheet = document.getElementById(this.stylesheetId);

    if (!stylesheet) {
      this.log("Stylesheet element missing, recreating...");
      this.updateStyles(this.currentCSS);
      return false;
    }

    if (stylesheet.textContent !== this.currentCSS) {
      this.log("Stylesheet content mismatch, fixing...");
      stylesheet.textContent = this.currentCSS;
      return false;
    }

    return true;
  }

  /**
   * Sets up a periodic validation check
   * @param {number} interval - Check interval in milliseconds
   */
  startValidationCheck(interval = 5000) {
    setInterval(() => {
      this.validateStylesheet();
    }, interval);

    this.log("Started stylesheet validation checks");
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet StyleInjector] ${message}`, data);
      } else {
        console.log(`[ZenInternet StyleInjector] ${message}`);
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
      console.error(`[ZenInternet StyleInjector] ${message}`, error);
    } else {
      console.error(`[ZenInternet StyleInjector] ${message}`);
    }
  }
}
