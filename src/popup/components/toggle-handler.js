/**
 * Toggle Handler for Zen Internet extension popup
 * Handles toggle interactions and state management
 */

import { STORAGE_KEYS } from "../../shared/constants.js";

export class ToggleHandler {
  constructor(settingsController) {
    this.settingsController = settingsController;
    this.logging = false;
  }

  /**
   * Handles toggle changes
   * @param {string} toggleId - Toggle element ID
   * @param {boolean} checked - Whether toggle is checked
   * @param {string} hostname - Current hostname (for site-specific toggles)
   * @returns {Promise<boolean>} - Success status
   */
  async handleToggle(toggleId, checked, hostname) {
    this.log(
      `Handling toggle: ${toggleId} = ${checked} for ${hostname || "global"}`
    );

    try {
      switch (toggleId) {
        case "enable-styling":
          return await this.handleGlobalToggle("enableStyling", checked);

        case "auto-update":
          return await this.handleAutoUpdateToggle(checked);

        case "force-styling":
          return await this.handleGlobalToggle("forceStyling", checked);

        case "whitelist-mode":
          return await this.handleGlobalToggle("whitelistMode", checked);

        case "whitelist-style-mode":
          return await this.handleGlobalToggle("whitelistStyleMode", checked);

        case "skip-theming":
          return await this.handleSiteToggle("styling", hostname, checked);

        case "skip-force-theming":
          return await this.handleSiteToggle("forceTheming", hostname, checked);

        case "fallback-background":
          return await this.handleSiteToggle(
            "fallbackBackground",
            hostname,
            checked
          );

        default:
          this.logError(`Unknown toggle ID: ${toggleId}`);
          return false;
      }
    } catch (error) {
      this.logError(`Error handling toggle ${toggleId}`, error);
      return false;
    }
  }

  /**
   * Handles global setting toggles
   * @param {string} settingKey - Setting key
   * @param {boolean} value - Setting value
   * @returns {Promise<boolean>} - Success status
   */
  async handleGlobalToggle(settingKey, value) {
    const success = await this.settingsController.updateGlobalSetting(
      settingKey,
      value
    );

    if (success) {
      this.log(`Global setting ${settingKey} updated to ${value}`);
    }

    return success;
  }

  /**
   * Handles auto-update toggle with service communication
   * @param {boolean} enabled - Whether auto-update is enabled
   * @returns {Promise<boolean>} - Success status
   */
  async handleAutoUpdateToggle(enabled) {
    // Update setting first
    const settingSuccess = await this.handleGlobalToggle("autoUpdate", enabled);

    if (!settingSuccess) {
      return false;
    }

    // Communicate with background service
    try {
      let serviceSuccess;

      if (enabled) {
        serviceSuccess = await this.settingsController.enableAutoUpdate();
      } else {
        serviceSuccess = await this.settingsController.disableAutoUpdate();
      }

      if (serviceSuccess) {
        this.log(
          `Auto-update ${enabled ? "enabled" : "disabled"} successfully`
        );
      }

      return serviceSuccess;
    } catch (error) {
      this.logError("Error communicating with auto-update service", error);
      return false;
    }
  }

  /**
   * Handles site-specific toggles
   * @param {string} toggleType - Type of toggle (styling, forceTheming, fallbackBackground)
   * @param {string} hostname - Hostname
   * @param {boolean} checked - Whether toggle is checked
   * @returns {Promise<boolean>} - Success status
   */
  async handleSiteToggle(toggleType, hostname, checked) {
    if (!hostname) {
      this.logError("No hostname provided for site toggle");
      return false;
    }

    switch (toggleType) {
      case "styling":
        return await this.settingsController.handleStylingToggle(
          hostname,
          checked
        );

      case "forceTheming":
        return await this.settingsController.handleForceThemingToggle(
          hostname,
          checked
        );

      case "fallbackBackground":
        return await this.settingsController.handleFallbackBackgroundToggle(
          hostname,
          checked
        );

      default:
        this.logError(`Unknown site toggle type: ${toggleType}`);
        return false;
    }
  }

  /**
   * Gets the current state of a toggle
   * @param {string} toggleId - Toggle element ID
   * @param {string} hostname - Current hostname (for site-specific toggles)
   * @returns {boolean} - Current toggle state
   */
  getToggleState(toggleId, hostname) {
    const globalSettings = this.settingsController.getGlobalSettings();

    switch (toggleId) {
      case "enable-styling":
        return globalSettings.enableStyling ?? true;

      case "auto-update":
        return globalSettings.autoUpdate ?? false;

      case "force-styling":
        return globalSettings.forceStyling ?? false;

      case "whitelist-mode":
        return globalSettings.whitelistMode ?? false;

      case "whitelist-style-mode":
        return globalSettings.whitelistStyleMode ?? false;

      case "skip-theming":
        if (!hostname) return false;
        return this.settingsController.getEffectiveToggleState(
          STORAGE_KEYS.SKIP_THEMING,
          hostname
        );

      case "skip-force-theming":
        if (!hostname) return false;
        return this.settingsController.getEffectiveToggleState(
          STORAGE_KEYS.SKIP_FORCE_THEMING,
          hostname
        );

      case "fallback-background":
        if (!hostname) return false;
        return this.settingsController.getEffectiveToggleState(
          STORAGE_KEYS.FALLBACK_BACKGROUND,
          hostname
        );

      default:
        return false;
    }
  }

  /**
   * Validates toggle changes before applying
   * @param {string} toggleId - Toggle element ID
   * @param {boolean} checked - New toggle state
   * @param {string} hostname - Current hostname
   * @returns {Object} - Validation result
   */
  validateToggleChange(toggleId, checked, hostname) {
    const errors = [];
    const warnings = [];

    // Validate site-specific toggles have hostname
    const siteSpecificToggles = [
      "skip-theming",
      "skip-force-theming",
      "fallback-background",
    ];
    if (siteSpecificToggles.includes(toggleId) && !hostname) {
      errors.push("Hostname is required for site-specific toggles");
    }

    // Warn about potential conflicts
    const globalSettings = this.settingsController.getGlobalSettings();

    if (toggleId === "enable-styling" && !checked) {
      warnings.push("Disabling global styling will affect all sites");
    }

    if (
      toggleId === "force-styling" &&
      checked &&
      !globalSettings.enableStyling
    ) {
      warnings.push("Force styling requires global styling to be enabled");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Gets toggle description for UI
   * @param {string} toggleId - Toggle element ID
   * @returns {string} - Toggle description
   */
  getToggleDescription(toggleId) {
    const descriptions = {
      "enable-styling": "Master toggle for all CSS styling functionality",
      "auto-update":
        "Automatically check for and download new styles every 2 hours",
      "force-styling": "Apply basic styling to sites without specific themes",
      "whitelist-mode": "Only apply forced styling to sites in the allow list",
      "whitelist-style-mode":
        "Only apply regular styling to sites in the allow list",
      "skip-theming": "Skip styling for this specific site",
      "skip-force-theming": "Skip forced styling for this specific site",
      "fallback-background":
        "Add a solid background to prevent transparency issues",
    };

    return descriptions[toggleId] || "Toggle setting";
  }

  /**
   * Logs a message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[ZenInternet ToggleHandler] ${message}`, data);
      } else {
        console.log(`[ZenInternet ToggleHandler] ${message}`);
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
      console.error(`[ZenInternet ToggleHandler] ${message}`, error);
    } else {
      console.error(`[ZenInternet ToggleHandler] ${message}`);
    }
  }
}
