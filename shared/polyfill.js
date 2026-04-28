/**
 * Minimal browser polyfill for Chromium (Window and Service Worker)
 */
const root = typeof self !== "undefined" ? self : this;

if (typeof root.browser === "undefined" && typeof root.chrome !== "undefined") {
    const c = root.chrome;

    const wrapPromise = (fn, context) => {
        if (!fn) return undefined;
        return (...args) => {
            return new Promise((resolve, reject) => {
                try {
                    fn.call(context, ...args, (result) => {
                        if (c.runtime.lastError) {
                            const err = new Error(c.runtime.lastError.message || "Unknown error");
                            Object.assign(err, c.runtime.lastError);
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            });
        };
    };

    const wrapEvent = (event) => {
        if (!event) return undefined;
        return {
            addListener: event.addListener.bind(event),
            removeListener: event.removeListener.bind(event),
            hasListener: event.hasListener.bind(event),
        };
    };

    root.browser = {
        storage: {
            local: {
                get: wrapPromise(c.storage?.local?.get, c.storage?.local),
                set: wrapPromise(c.storage?.local?.set, c.storage?.local),
                clear: wrapPromise(c.storage?.local?.clear, c.storage?.local),
            },
            onChanged: wrapEvent(c.storage?.onChanged),
        },
        tabs: {
            query: wrapPromise(c.tabs?.query, c.tabs),
            get: wrapPromise(c.tabs?.get, c.tabs),
            sendMessage: wrapPromise(c.tabs?.sendMessage, c.tabs),
            create: wrapPromise(c.tabs?.create, c.tabs),
            reload: wrapPromise(c.tabs?.reload, c.tabs),
            onUpdated: wrapEvent(c.tabs?.onUpdated),
            onActivated: wrapEvent(c.tabs?.onActivated),
        },
        runtime: {
            sendMessage: wrapPromise(c.runtime?.sendMessage, c.runtime),
            onMessage: wrapEvent(c.runtime?.onMessage),
            getURL: c.runtime?.getURL?.bind(c.runtime),
            getManifest: c.runtime?.getManifest?.bind(c.runtime),
            lastError: c.runtime?.lastError,
        },
        webNavigation: {
            onBeforeNavigate: wrapEvent(c.webNavigation?.onBeforeNavigate),
            onCommitted: wrapEvent(c.webNavigation?.onCommitted),
        },
        commands: {
            onCommand: wrapEvent(c.commands?.onCommand),
        },
        alarms: {
            create: c.alarms?.create?.bind(c.alarms),
            onAlarm: wrapEvent(c.alarms?.onAlarm),
        },
        action: c.action ? {
            setIcon: wrapPromise(c.action.setIcon, c.action),
        } : undefined,
        browserAction: c.browserAction ? {
            setIcon: wrapPromise(c.browserAction.setIcon, c.browserAction),
        } : undefined,
    };

    // Map browserAction to action for MV3 compatibility
    if (root.browser.action && !root.browser.browserAction) {
        root.browser.browserAction = root.browser.action;
    } else if (!root.browser.action && root.browser.browserAction) {
        root.browser.action = root.browser.browserAction;
    }
}
