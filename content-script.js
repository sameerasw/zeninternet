(function () {
  const STYLE_ID = "zeninternet-styles";
  let observer = null;

  /**
   * Centralized logging helper that respects the enableLogs setting.
   */
  async function log(...args) {
    try {
      const result = await browser.storage.local.get("transparentZenSettings");
      const settings = result["transparentZenSettings"] || {};
      if (settings.enableLogs) {
        console.log("[ZenInternet]", ...args);
      }
    } catch (e) {}
  }

  /**
   * Returns our style element or creates it if it doesn't exist.
   */
  function getOrCreateStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
    }
    return el;
  }

  /**
   * Positions our style element at the end of head for maximum cascade priority.
   */
  function ensureLastInHead() {
    const head = document.head || document.documentElement;
    const el = getOrCreateStyleEl();
    if (head.lastChild !== el) {
      head.appendChild(el);
    }
  }

  /**
   * Watches head for dynamically injected stylesheets and re-anchors ours.
   */
  function startObserver() {
    if (observer) return;
    const head = document.head || document.documentElement;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          const addedOurs = Array.from(m.addedNodes).some(
            (n) => n.id === STYLE_ID
          );
          if (!addedOurs) {
            log("Head mutation detected, re-applying styles...");
            ensureLastInHead();
          }
          break;
        }
      }
    });
    observer.observe(head, { childList: true });
  }

  /**
   * Updates style content and ensures they are applied with top priority.
   */
  function applyStyles(css) {
    log("Applying styles to page...");
    const el = getOrCreateStyleEl();
    el.textContent = css || "";
    ensureLastInHead();
    startObserver();
  }

  /**
   * Clears the current styles.
   */
  function removeStyles() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.textContent = "";
  }

  /**
   * Injects the required CSS for the  glow animations.
   */
  function injectAnimationCSS() {
    const id = "zen-animations-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes zen-glow-out {
        0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(15); opacity: 0; }
      }
      @keyframes zen-glow-in {
        0% { transform: translate(-50%, -50%) scale(15); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.6; }
      }
      @keyframes zen-toast-in {
        0% { transform: translateX(120%) scale(0.9); opacity: 0; }
        70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
        100% { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes zen-toast-out {
        0% { transform: translateX(0) scale(1); opacity: 1; }
        100% { transform: translateX(120%) scale(0.9); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Creates a  glow ring animation originating from the toast position.
   */
  function createGlowRing(isEnabled) {
    injectAnimationCSS();
    const ring = document.createElement("div");
    const accentColor = "#f98764";
    
    Object.assign(ring.style, {
      position: "fixed",
      top: "40px",
      right: "40px",
      width: "150px",
      height: "150px",
      borderRadius: "50%",
      border: `4px solid ${accentColor}`,
      boxShadow: `0 0 60px ${accentColor}, inset 0 0 60px ${accentColor}`,
      filter: "blur(20px)",
      pointerEvents: "none",
      zIndex: "2147483646",
      opacity: "0",
      transform: "translate(-50%, -50%)"
    });

    ring.style.animation = isEnabled 
      ? "zen-glow-out 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" 
      : "zen-glow-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards";

    document.documentElement.appendChild(ring);
    setTimeout(() => ring.remove(), 1300);
  }

  /**
   * Displays a premium toast notification in the top-right corner.
   */
  function showToast(text, isEnabled) {
    createGlowRing(isEnabled);
    const existing = document.getElementById("zeninternet-toast");
    if (existing) existing.remove();

    const isLightMode = window.matchMedia("(prefers-color-scheme: light)").matches;

    const toast = document.createElement("div");
    toast.id = "zeninternet-toast";
    
    // Theme-aware styling matching extension
    const accentColor = "#f98764";
    const switchBgOff = isLightMode ? "#ced4da" : "#4c4c63";
    const toastBg = isLightMode ? "rgba(245, 247, 250, 0.9)" : "rgba(25, 25, 25, 0.85)";
    const toastColor = isLightMode ? "#343a40" : "#ffffff";
    const shadowColor = isLightMode ? "rgba(0, 0, 0, 0.15)" : "rgba(0, 0, 0, 0.4)";
    const borderColor = isLightMode ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.1)";

    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "10px 16px",
      background: toastBg,
      backdropFilter: "blur(12px)",
      webkitBackdropFilter: "blur(12px)",
      color: toastColor,
      borderRadius: "14px",
      fontSize: "14px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontWeight: "500",
      boxShadow: `0 8px 32px ${shadowColor}, 0 0 0 1px ${borderColor}`,
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      pointerEvents: "none",
      transform: "translateX(120%) scale(0.9)",
      opacity: "0",
      animation: "zen-toast-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards"
    });

    const iconUrl = browser.runtime.getURL("assets/images/logo.png");
    
    toast.innerHTML = `
      <img src="${iconUrl}" style="width: 20px; height: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
      <span style="margin-right: 4px;">${text}</span>
      <div class="zen-toast-switch" style="
        position: relative;
        width: 32px;
        height: 18px;
        background-color: ${isEnabled ? accentColor : switchBgOff};
        border-radius: 18px;
        transition: background-color 0.2s;
      ">
        <div style="
          position: absolute;
          top: 3px;
          ${isEnabled ? "right: 3px;" : "left: 3px;"}
          width: 12px;
          height: 12px;
          background-color: white;
          border-radius: 50%;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `;

    document.documentElement.appendChild(toast);

    const closeToast = () => {
      toast.style.animation = "zen-toast-out 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards";
      setTimeout(() => toast.remove(), 500);
    };

    setTimeout(closeToast, 3000);
  }

  /**
   * YouTube Movable Live Chat Logic
   */
  class MovableLiveChat {
    constructor() {
      this.chatElement = null;
      this.dragHandle = null;
      this.resizeHandle = null;
      this.savedPosition = null;
      this.isEnabled = false;
      this.isTheater = false;
    }

    async init() {
      if (!window.location.hostname.includes("youtube.com")) return;

      const hostname = "youtube.com";
      const siteKey = `transparentZenSettings.${hostname}`;
      const data = await browser.storage.local.get([siteKey, "liveChatPosition"]);
      
      const siteSettings = data[siteKey] || {};
      this.isEnabled = siteSettings.movableLiveChat !== false;
      this.savedPosition = data.liveChatPosition || null;

      if (!this.isEnabled) {
        this.destroy();
        return;
      }

      this.injectMovableStyles();
      this.observeChanges();
      this.checkIframeTransparency();
    }

    destroy() {
      if (this.chatElement) {
        this.chatElement.classList.remove("zen-movable");
        this.chatElement.style.removeProperty('top');
        this.chatElement.style.removeProperty('left');
        this.chatElement.style.removeProperty('width');
        this.chatElement.style.removeProperty('height');
        this.chatElement.style.removeProperty('right');
        this.chatElement.style.removeProperty('bottom');
        this.chatElement.style.removeProperty('position');
      }
      const handle = document.querySelector(".zen-drag-handle");
      if (handle) handle.remove();
      const rHandle = document.querySelector(".zen-resize-handle");
      if (rHandle) rHandle.remove();
      const styles = document.getElementById("zen-movable-chat-styles");
      if (styles) styles.remove();
      this.chatElement = null;
    }

    injectMovableStyles() {
      if (document.getElementById("zen-movable-chat-styles")) return;
      const style = document.createElement("style");
      style.id = "zen-movable-chat-styles";
      style.textContent = `
        ytd-watch-flexy[theater] #chat.zen-movable {
          position: fixed !important;
          z-index: 2001 !important;
          margin: 0 !important;
          transform: none !important;
          transition: none !important;
          display: flex !important;
          flex-direction: column !important;
          background: var(--bg-color, #1e1e2e) !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          min-width: 200px !important;
          min-height: 200px !important;
        }
        #chat.zen-movable .zen-drag-handle {
          height: 12px !important;
          width: 100% !important;
          background: rgba(249, 135, 100, 0.4) !important;
          cursor: move !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 0 !important;
          transition: opacity 0.3s ease !important;
          z-index: 2002 !important;
          flex-shrink: 0 !important;
        }
        #chat.zen-movable:hover .zen-drag-handle {
          opacity: 1 !important;
        }
        #chat.zen-movable .zen-resize-handle {
          position: absolute !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 20px !important;
          height: 20px !important;
          cursor: nwse-resize !important;
          background: linear-gradient(135deg, transparent 50%, #f98764 60%) !important;
          z-index: 2003 !important;
          border-radius: 0 0 12px 0 !important;
          opacity: 0 !important;
          transition: opacity 0.3s ease !important;
        }
        #chat.zen-movable:hover .zen-resize-handle {
          opacity: 1 !important;
        }
      `;
      document.head.appendChild(style);
    }

    checkIframeTransparency() {
      if (window.location.pathname.startsWith("/live_chat")) {
        const style = document.createElement("style");
        style.textContent = `
          yt-live-chat-renderer {
            background: none !important;
            background-color: transparent !important;
          }
          #separator { display: none !important; }
        `;
        document.head.appendChild(style);
      }
    }

    observeChanges() {
      const watchFlexy = document.querySelector("ytd-watch-flexy");
      if (watchFlexy) {
        this.isTheater = watchFlexy.hasAttribute("theater");
        const attrObserver = new MutationObserver(() => {
          const nowTheater = watchFlexy.hasAttribute("theater");
          if (nowTheater !== this.isTheater) {
            this.isTheater = nowTheater;
            this.updateChatPosition();
          }
        });
        attrObserver.observe(watchFlexy, { attributes: true, attributeFilter: ["theater"] });
      }

      const chatObserver = new MutationObserver(() => {
        const chat = document.querySelector("#chat");
        if (chat && (chat !== this.chatElement || !chat.classList.contains("zen-movable"))) {
          this.setupDraggable(chat);
        }
      });
      chatObserver.observe(document.body, { childList: true, subtree: true });
      
      const chat = document.querySelector("#chat");
      if (chat) this.setupDraggable(chat);
    }

    setupDraggable(chat) {
      if (chat.classList.contains("zen-movable")) return;
      this.chatElement = chat;
      chat.classList.add("zen-movable");

      const handle = document.createElement("div");
      handle.className = "zen-drag-handle";
      chat.insertBefore(handle, chat.firstChild);
      this.dragHandle = handle;

      const resizeHandle = document.createElement("div");
      resizeHandle.className = "zen-resize-handle";
      chat.appendChild(resizeHandle);
      this.resizeHandle = resizeHandle;

      this.updateChatPosition();

      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

      const elementDrag = (e) => {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        const newTop = this.chatElement.offsetTop - pos2;
        const newLeft = this.chatElement.offsetLeft - pos1;

        this.chatElement.style.setProperty('top', newTop + "px", 'important');
        this.chatElement.style.setProperty('left', newLeft + "px", 'important');
        this.chatElement.style.setProperty('right', 'auto', 'important');
        this.chatElement.style.setProperty('bottom', 'auto', 'important');
      };

      const closeDragElement = () => {
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('mousemove', elementResize);
        this.savePosition();
      };

      handle.onmousedown = (e) => {
        const isTheaterNow = document.querySelector("ytd-watch-flexy[theater]");
        if (!isTheaterNow) return;
        
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
      };

      let startWidth, startHeight, startX, startY;

      const elementResize = (e) => {
        e.preventDefault();
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        
        if (newWidth > 200) this.chatElement.style.setProperty('width', newWidth + "px", 'important');
        if (newHeight > 200) this.chatElement.style.setProperty('height', newHeight + "px", 'important');
      };

      resizeHandle.onmousedown = (e) => {
        const isTheaterNow = document.querySelector("ytd-watch-flexy[theater]");
        if (!isTheaterNow) return;

        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        const rect = this.chatElement.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementResize);
      };
    }

    updateChatPosition() {
      if (!this.chatElement) return;
      const isActuallyTheater = document.querySelector("ytd-watch-flexy[theater]");
      if (isActuallyTheater && this.savedPosition) {
        this.chatElement.style.setProperty('top', this.savedPosition.top || "50px", 'important');
        this.chatElement.style.setProperty('left', this.savedPosition.left || "50px", 'important');
        this.chatElement.style.setProperty('width', this.savedPosition.width || "400px", 'important');
        this.chatElement.style.setProperty('height', this.savedPosition.height || "600px", 'important');
        this.chatElement.style.setProperty('right', 'auto', 'important');
        this.chatElement.style.setProperty('bottom', 'auto', 'important');
      } else {
        this.chatElement.style.removeProperty('top');
        this.chatElement.style.removeProperty('left');
        this.chatElement.style.removeProperty('width');
        this.chatElement.style.removeProperty('height');
        this.chatElement.style.removeProperty('right');
        this.chatElement.style.removeProperty('bottom');
      }
    }

    async savePosition() {
      if (!this.chatElement) return;
      const position = {
        top: this.chatElement.style.top,
        left: this.chatElement.style.left,
        width: this.chatElement.style.width,
        height: this.chatElement.style.height
      };
      await browser.storage.local.set({ liveChatPosition: position });
      this.savedPosition = position;
    }
  }

  const movableChat = new MovableLiveChat();
  movableChat.init();

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "refreshMovableChat") {
      movableChat.init();
      return Promise.resolve({ success: true });
    }
    if (message.action === "applyStyles") {
      applyStyles(message.css);
      return Promise.resolve({ success: true });
    }
    if (message.action === "removeStyles") {
      removeStyles();
      return Promise.resolve({ success: true });
    }
    if (message.action === "showToast") {
      showToast(message.text, message.isEnabled);
      return Promise.resolve({ success: true });
    }
    return false;
  });

  try {
    browser.runtime.sendMessage({
      action: "contentScriptReady",
      hostname: window.location.hostname,
    }).catch(() => {});
  } catch (e) {}
})();
