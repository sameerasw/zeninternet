/**
 * Hostname utility functions for Zen Internet extension
 */

/**
 * Normalizes hostname by removing www. prefix
 * @param {string} hostname - The hostname to normalize
 * @returns {string} - Normalized hostname
 */
export function normalizeHostname(hostname) {
  return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
}

/**
 * Checks if a site matches a pattern (exact, wildcard, or TLD match)
 * @param {string} hostname - The hostname to check
 * @param {string} pattern - The pattern to match against
 * @returns {boolean} - Whether the hostname matches the pattern
 */
export function matchesPattern(hostname, pattern) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedPattern = normalizeHostname(pattern);

  // Exact match has priority
  if (normalizedHostname === normalizedPattern) {
    return true;
  }

  // Wildcard match (with proper domain boundary)
  if (pattern.startsWith("+")) {
    const domain = pattern.substring(1);
    const normalizedDomain = normalizeHostname(domain);

    // Check if hostname ends with the domain (with dot boundary)
    return (
      normalizedHostname === normalizedDomain ||
      normalizedHostname.endsWith("." + normalizedDomain)
    );
  }

  // TLD suffix match (match domain regardless of TLD)
  if (pattern.startsWith("-")) {
    const domainWithoutTLD = pattern.substring(1);
    const normalizedDomainWithoutTLD = normalizeHostname(domainWithoutTLD);

    // Extract domain part without TLD from hostname
    const hostnameParts = normalizedHostname.split(".");
    if (hostnameParts.length >= 2) {
      const hostnameWithoutTLD = hostnameParts.slice(0, -1).join(".");
      return hostnameWithoutTLD === normalizedDomainWithoutTLD;
    }
  }

  return false;
}

/**
 * Finds the best matching pattern for a hostname from a list
 * @param {string} hostname - The hostname to match
 * @param {string[]} patterns - Array of patterns to check
 * @returns {Object|null} - Object with pattern and match type, or null if no match
 */
export function findBestMatch(hostname, patterns) {
  const normalizedHostname = normalizeHostname(hostname);
  let bestMatch = null;
  let bestMatchLength = 0;
  let matchType = "none";

  for (const pattern of patterns) {
    if (matchesPattern(hostname, pattern)) {
      const normalizedPattern = normalizeHostname(pattern.replace(/^[+-]/, ""));

      // Prioritize exact matches
      if (normalizedHostname === normalizedPattern) {
        return { pattern, matchType: "exact" };
      }

      // For wildcard and TLD matches, prefer longer patterns
      if (normalizedPattern.length > bestMatchLength) {
        bestMatch = pattern;
        bestMatchLength = normalizedPattern.length;
        matchType = pattern.startsWith("+")
          ? "wildcard"
          : pattern.startsWith("-")
          ? "tld"
          : "partial";
      }
    }
  }

  return bestMatch ? { pattern: bestMatch, matchType } : null;
}
