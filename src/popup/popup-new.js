/**
 * Popup Entry Point for Zen Internet extension
 * Main popup script that initializes the popup controller
 */

import { PopupController } from "./core/popup-controller.js";

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the popup controller
  const popupController = new PopupController();

  // Make available for debugging
  if (typeof globalThis !== "undefined") {
    globalThis.zenInternetPopup = popupController;
  }

  console.log("[ZenInternet Popup] Popup initialized");
});
