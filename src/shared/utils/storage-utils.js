/**
 * Storage utility functions for Zen Internet extension
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from "../constants.js";
import { ensureDefaultSettings } from "../defaults.js";

/**
 * Gets data from browser storage with error handling
 * @param {string|string[]} keys - Storage keys to retrieve
 * @returns {Promise<Object>} - Storage data
 */
export async function getStorageData(keys) {
  try {
    return await browser.storage.local.get(keys);
  } catch (error) {
    console.error("Error getting storage data:", error);
    return {};
  }
}

/**
 * Sets data in browser storage with error handling
 * @param {Object} data - Data to store
 * @returns {Promise<boolean>} - Success status
 */
export async function setStorageData(data) {
  try {
    await browser.storage.local.set(data);
    return true;
  } catch (error) {
    console.error("Error setting storage data:", error);
    return false;
  }
}

/**
 * Gets global settings with defaults applied
 * @returns {Promise<Object>} - Global settings
 */
export async function getGlobalSettings() {
  const data = await getStorageData(STORAGE_KEYS.BROWSER_STORAGE);
  return ensureDefaultSettings(data[STORAGE_KEYS.BROWSER_STORAGE] || {});
}

/**
 * Saves global settings
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveGlobalSettings(settings) {
  const validatedSettings = ensureDefaultSettings(settings);
  return await setStorageData({
    [STORAGE_KEYS.BROWSER_STORAGE]: validatedSettings,
  });
}

/**
 * Gets site-specific settings
 * @param {string} hostname - The hostname to get settings for
 * @returns {Promise<Object>} - Site-specific settings
 */
export async function getSiteSettings(hostname) {
  const siteKey = `${STORAGE_KEYS.BROWSER_STORAGE}.${hostname}`;
  const data = await getStorageData(siteKey);
  return data[siteKey] || {};
}

/**
 * Saves site-specific settings
 * @param {string} hostname - The hostname to save settings for
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSiteSettings(hostname, settings) {
  const siteKey = `${STORAGE_KEYS.BROWSER_STORAGE}.${hostname}`;
  return await setStorageData({ [siteKey]: settings });
}

/**
 * Gets a list from storage
 * @param {string} listKey - The storage key for the list
 * @returns {Promise<string[]>} - The list
 */
export async function getList(listKey) {
  const data = await getStorageData(listKey);
  return data[listKey] || [];
}

/**
 * Saves a list to storage
 * @param {string} listKey - The storage key for the list
 * @param {string[]} list - The list to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveList(listKey, list) {
  return await setStorageData({ [listKey]: list });
}

/**
 * Adds an item to a list in storage
 * @param {string} listKey - The storage key for the list
 * @param {string} item - Item to add
 * @returns {Promise<boolean>} - Success status
 */
export async function addToList(listKey, item) {
  const list = await getList(listKey);
  if (!list.includes(item)) {
    list.push(item);
    return await saveList(listKey, list);
  }
  return true;
}

/**
 * Removes an item from a list in storage
 * @param {string} listKey - The storage key for the list
 * @param {string} item - Item to remove
 * @returns {Promise<boolean>} - Success status
 */
export async function removeFromList(listKey, item) {
  const list = await getList(listKey);
  const index = list.indexOf(item);
  if (index !== -1) {
    list.splice(index, 1);
    return await saveList(listKey, list);
  }
  return true;
}

/**
 * Clears all extension data
 * @returns {Promise<boolean>} - Success status
 */
export async function clearAllData() {
  try {
    await browser.storage.local.clear();
    return true;
  } catch (error) {
    console.error("Error clearing all data:", error);
    return false;
  }
}
