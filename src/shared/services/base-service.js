/**
 * Base service class for Zen Internet extension services
 */

export class BaseService {
  constructor(name) {
    this.name = name;
    this.logging = true;
  }

  /**
   * Logs a message if logging is enabled
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    if (this.logging) {
      if (data) {
        console.log(`[${this.name}] ${message}`, data);
      } else {
        console.log(`[${this.name}] ${message}`);
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
      console.error(`[${this.name}] ${message}`, error);
    } else {
      console.error(`[${this.name}] ${message}`);
    }
  }

  /**
   * Logs a warning message
   * @param {string} message - Warning message
   * @param {any} data - Optional data to log
   */
  logWarning(message, data = null) {
    if (data) {
      console.warn(`[${this.name}] ${message}`, data);
    } else {
      console.warn(`[${this.name}] ${message}`);
    }
  }

  /**
   * Handle async operations with error logging
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise<any>} - Result of the operation or null on error
   */
  async safeAsync(operation, operationName) {
    try {
      return await operation();
    } catch (error) {
      this.logError(`Error in ${operationName}`, error);
      return null;
    }
  }

  /**
   * Creates a debounced version of a function
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
   * Creates a throttled version of a function
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
