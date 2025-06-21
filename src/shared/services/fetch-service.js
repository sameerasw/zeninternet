/**
 * Fetch service for HTTP requests with error handling
 */

/**
 * Fetch service class for centralized HTTP requests
 */
export class FetchService {
  constructor() {
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  /**
   * Perform GET request with error handling
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async get(url, options = {}) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error(`GET request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Perform POST request with error handling
   * @param {string} url - URL to post to
   * @param {Object} data - Data to send
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async post(url, data, options = {}) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(data),
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error(`POST request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch JSON data with error handling
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - JSON data
   */
  async getJson(url, options = {}) {
    try {
      const response = await this.get(url, options);
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch JSON from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch styles from repository with cache control
   * @param {string} repositoryUrl - Repository URL
   * @returns {Promise<Object>} - Styles data
   */
  async fetchStyles(repositoryUrl) {
    try {
      const response = await this.get(repositoryUrl, {
        headers: {
          "Cache-Control": "no-cache",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch styles: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching styles:", error);
      throw error;
    }
  }

  /**
   * Check if URL is reachable
   * @param {string} url - URL to check
   * @returns {Promise<boolean>} - Whether URL is reachable
   */
  async isUrlReachable(url) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
      });
      return true;
    } catch (error) {
      console.error(`URL ${url} is not reachable:`, error);
      return false;
    }
  }

  /**
   * Download file as blob
   * @param {string} url - URL to download
   * @returns {Promise<Blob>} - File blob
   */
  async downloadFile(url) {
    try {
      const response = await this.get(url);
      return await response.blob();
    } catch (error) {
      console.error(`Failed to download file from ${url}:`, error);
      throw error;
    }
  }
}
