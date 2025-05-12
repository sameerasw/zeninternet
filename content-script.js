(function () {
  const stylesheetId = "zeninternet-custom-styles";
  const isIframe = window !== window.top;

  // Create or get our stylesheet element
  function getStylesheet() {
    let stylesheet = document.getElementById(stylesheetId);
    if (!stylesheet) {
      stylesheet = document.createElement("style");
      stylesheet.id = stylesheetId;
      stylesheet.type = "text/css";
      document.head.appendChild(stylesheet);
    }
    return stylesheet;
  }

  // Apply iframe transparency if this is an iframe
  function applyIframeTransparency() {
    if (isIframe) {
      // Make the iframe content transparent
      const transparencyStyle = document.createElement("style");
      transparencyStyle.id = "zeninternet-iframe-transparency";
      transparencyStyle.textContent = `
        html, body { 
          background: transparent !important;
          background-color: transparent !important;
        }
      `;
      document.head.appendChild(transparencyStyle);

      // Set direct styles on the document
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";

      console.log("ZenInternet: Applied iframe transparency");
    }
  }

  // Update our stylesheet content
  function updateStyles(css) {
    const stylesheet = getStylesheet();
    stylesheet.textContent = css || "";
    console.log(
      `ZenInternet: Styles were ${css ? "updated" : "removed"} in ${
        isIframe ? "iframe" : "main document"
      }`
    );

    // Always try to apply iframe transparency for iframes
    if (isIframe) {
      applyIframeTransparency();
    }
  }

  // Announce content script is ready and provide current hostname with frame context
  function announceReady() {
    try {
      browser.runtime
        .sendMessage({
          action: "contentScriptReady",
          hostname: window.location.hostname,
          isIframe: isIframe,
          href: window.location.href,
          parentUrl: isIframe && window.parent ? document.referrer : null,
        })
        .catch((err) => {
          // Silent fail - background might not be ready yet
          console.log("ZenInternet: Could not announce ready state");
        });
    } catch (e) {
      // Fail silently
    }
  }

  // Listen for messages from background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "applyStyles") {
      updateStyles(message.css);
      return Promise.resolve({ success: true });
    } else if (message.action === "makeTransparent") {
      applyIframeTransparency();
      return Promise.resolve({ success: true });
    }
    return false;
  });

  // Apply iframe transparency immediately if this is an iframe
  if (isIframe) {
    applyIframeTransparency();
  }

  // Announce content script is ready on load
  announceReady();
})();
