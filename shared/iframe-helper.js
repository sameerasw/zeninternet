/**
 * Helper functions for handling iframes in Zen Internet
 */

/**
 * Makes an iframe transparent by setting its style and attributes
 * @param {HTMLIFrameElement} iframe - The iframe element to make transparent
 */
function makeIframeTransparent(iframe) {
  if (!iframe || !(iframe instanceof HTMLIFrameElement)) return;

  // Set multiple transparency-related properties
  iframe.style.background = "transparent";
  iframe.style.backgroundColor = "transparent";
  iframe.allowTransparency = true;
  iframe.setAttribute("allowtransparency", "true");

  // Add a data attribute to mark it as processed
  iframe.setAttribute("data-zen-transparent", "true");

  console.log("ZenInternet: Made iframe transparent:", iframe.src);
}

/**
 * Find all iframes in the document and make them transparent
 * @returns {number} The number of iframes processed
 */
function makeAllIframesTransparent() {
  const iframes = document.querySelectorAll(
    'iframe:not([data-zen-transparent="true"])'
  );
  let count = 0;

  for (const iframe of iframes) {
    makeIframeTransparent(iframe);
    count++;
  }

  return count;
}

/**
 * Observes the DOM for new iframes and makes them transparent
 */
function observeIframes() {
  // First process existing iframes
  makeAllIframesTransparent();

  // Then set up an observer for new iframes
  const observer = new MutationObserver((mutations) => {
    let needsProcessing = false;

    // Check if any mutations added iframes
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          // If direct iframe was added
          if (node.nodeName === "IFRAME") {
            makeIframeTransparent(node);
          }
          // Check for iframes deeper in the added content
          else if (node.nodeType === 1) {
            // Element node
            const iframes = node.querySelectorAll(
              'iframe:not([data-zen-transparent="true"])'
            );
            if (iframes.length > 0) {
              needsProcessing = true;
            }
          }
        }
      }
    }

    // If we detected potential iframes, scan the whole document
    if (needsProcessing) {
      makeAllIframesTransparent();
    }
  });

  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Export functions
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    makeIframeTransparent,
    makeAllIframesTransparent,
    observeIframes,
  };
}
