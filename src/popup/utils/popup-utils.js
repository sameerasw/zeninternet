/**
 * Popup utility functions
 */

import { normalizeHostname } from "../../shared/utils/hostname-utils.js";

/**
 * Popup utilities class
 */
export class PopupUtils {
  constructor() {
    this.logging = false;
  }

  /**
   * Get current tab information
   * @returns {Promise<Object|null>} - Current tab info or null
   */
  async getCurrentTabInfo() {
    if (this.logging) {
      console.log("DEBUG: Getting current tab info");
    }

    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs.length === 0) {
        console.warn("No active tab found");
        return null;
      }

      const tab = tabs[0];

      if (
        !tab.url ||
        (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
      ) {
        console.log("Current tab is not a web page");
        return {
          hostname: null,
          url: tab.url,
          title: tab.title,
          isWebPage: false,
        };
      }

      const url = new URL(tab.url);
      const hostname = url.hostname;
      const normalizedHostname = normalizeHostname(hostname);

      return {
        hostname,
        normalizedHostname,
        url: tab.url,
        title: tab.title,
        tabId: tab.id,
        isWebPage: true,
      };
    } catch (error) {
      console.error("Error getting current tab info:", error);
      return null;
    }
  }

  /**
   * Reload current page
   */
  async reloadPage() {
    try {
      const tabInfo = await this.getCurrentTabInfo();
      if (tabInfo && tabInfo.tabId) {
        await browser.tabs.reload(tabInfo.tabId);
        console.log("Page reloaded successfully");
      }
    } catch (error) {
      console.error("Error reloading page:", error);
    }
  }

  /**
   * Handle middle click events
   * @param {Event} event - Click event
   */
  handleMiddleClick(event) {
    if (event.button === 1) {
      // Middle mouse button
      event.preventDefault();
    }
  }

  /**
   * Display addon version
   * @param {HTMLElement} element - Element to display version in
   */
  async displayAddonVersion(element) {
    if (!element) return;

    try {
      const manifest = browser.runtime.getManifest();
      element.textContent = `Version: ${manifest.version}`;
    } catch (error) {
      console.error("Error displaying addon version:", error);
      element.textContent = "Version: Unknown";
    }
  }

  /**
   * Format time for display
   * @param {number} timestamp - Timestamp to format
   * @returns {string} - Formatted time string
   */
  formatTime(timestamp) {
    if (!timestamp) {
      return "Never";
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    }
  }

  /**
   * Show status message
   * @param {HTMLElement} element - Element to show message in
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, warning)
   * @param {number} duration - Duration to show message (ms)
   */
  showStatusMessage(element, message, type = "info", duration = 3000) {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message status-${type}`;

    // Clear message after duration
    if (duration > 0) {
      setTimeout(() => {
        element.textContent = "";
        element.className = "";
      }, duration);
    }
  }

  /**
   * Toggle element visibility
   * @param {HTMLElement} element - Element to toggle
   * @param {boolean} show - Whether to show or hide
   */
  toggleVisibility(element, show) {
    if (!element) return;

    if (show) {
      element.classList.remove("hidden", "collapsed");
    } else {
      element.classList.add("hidden");
    }
  }

  /**
   * Toggle collapsible section
   * @param {HTMLElement} button - Button that was clicked
   * @param {HTMLElement} content - Content to toggle
   */
  toggleCollapsible(button, content) {
    if (!button || !content) return;

    const isCollapsed = content.classList.contains("collapsed");
    const icon = button.querySelector("i");

    if (isCollapsed) {
      content.classList.remove("collapsed");
      if (icon) {
        icon.classList.remove("fa-chevron-down");
        icon.classList.add("fa-chevron-up");
      }
    } else {
      content.classList.add("collapsed");
      if (icon) {
        icon.classList.remove("fa-chevron-up");
        icon.classList.add("fa-chevron-down");
      }
    }
  }

  /**
   * Create toggle HTML
   * @param {string} id - Toggle ID
   * @param {string} label - Toggle label
   * @param {boolean} checked - Whether toggle is checked
   * @param {string} helpText - Help text for tooltip
   * @returns {string} - HTML string
   */
  createToggleHtml(id, label, checked = false, helpText = "") {
    const checkedAttr = checked ? "checked" : "";
    const helpIcon = helpText
      ? `<span class="help-icon" title="${helpText}">?</span>`
      : "";

    return `
      <div class="toggle-container">
        <label class="toggle-switch">
          <input type="checkbox" id="${id}" ${checkedAttr}>
          <span class="slider round"></span>
        </label>
        <span class="toggle-label">${label}</span>
        ${helpIcon}
      </div>
    `;
  }

  /**
   * Open URL in new tab
   * @param {string} url - URL to open
   */
  async openInNewTab(url) {
    try {
      await browser.tabs.create({ url });
    } catch (error) {
      console.error("Error opening URL in new tab:", error);
    }
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {boolean} - Whether settings are valid
   */
  validateSettings(settings) {
    if (!settings || typeof settings !== "object") {
      return false;
    }

    // Check for required boolean properties
    const booleanProps = [
      "enableStyling",
      "autoUpdate",
      "forceStyling",
      "whitelistMode",
      "whitelistStyleMode",
      "disableTransparency",
      "disableHover",
      "disableFooter",
    ];

    for (const prop of booleanProps) {
      if (
        settings.hasOwnProperty(prop) &&
        typeof settings[prop] !== "boolean"
      ) {
        console.warn(
          `Invalid setting ${prop}: expected boolean, got ${typeof settings[
            prop
          ]}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} - Debounced function
   */
  debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} - Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

// Export singleton instance
export const popupUtils = new PopupUtils();
