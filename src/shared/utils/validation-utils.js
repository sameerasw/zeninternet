/**
 * Validation utility functions for Zen Internet extension
 */

/**
 * Validates if a string is a valid URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a hostname is valid
 * @param {string} hostname - Hostname to validate
 * @returns {boolean} - Whether the hostname is valid
 */
export function isValidHostname(hostname) {
  if (!hostname || typeof hostname !== "string") {
    return false;
  }

  // Basic hostname validation
  const hostnameRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname);
}

/**
 * Validates if a URL is HTTP/HTTPS
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL is HTTP/HTTPS
 */
export function isHttpUrl(url) {
  return url && (url.startsWith("http://") || url.startsWith("https://"));
}

/**
 * Validates extension settings object
 * @param {Object} settings - Settings object to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateSettings(settings) {
  const errors = [];
  const result = { isValid: true, errors };

  if (!settings || typeof settings !== "object") {
    errors.push("Settings must be an object");
    result.isValid = false;
    return result;
  }

  // Validate boolean settings
  const booleanSettings = [
    "enableStyling",
    "autoUpdate",
    "forceStyling",
    "whitelistMode",
    "whitelistStyleMode",
    "disableTransparency",
    "disableHover",
    "disableFooter",
  ];

  for (const setting of booleanSettings) {
    if (
      settings[setting] !== undefined &&
      typeof settings[setting] !== "boolean"
    ) {
      errors.push(`${setting} must be a boolean`);
      result.isValid = false;
    }
  }

  // Validate array settings
  if (settings.fallbackBackgroundList !== undefined) {
    if (!Array.isArray(settings.fallbackBackgroundList)) {
      errors.push("fallbackBackgroundList must be an array");
      result.isValid = false;
    } else {
      for (const item of settings.fallbackBackgroundList) {
        if (typeof item !== "string") {
          errors.push("fallbackBackgroundList items must be strings");
          result.isValid = false;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Validates a JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {Object} - Validation result with isValid, data, and error
 */
export function validateJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    return { isValid: true, data, error: null };
  } catch (error) {
    return { isValid: false, data: null, error: error.message };
  }
}

/**
 * Sanitizes a filename for download
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9.-]/gi, "_").toLowerCase();
}

/**
 * Validates file type
 * @param {File} file - File to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {boolean} - Whether the file type is allowed
 */
export function validateFileType(file, allowedTypes) {
  return allowedTypes.includes(file.type);
}
