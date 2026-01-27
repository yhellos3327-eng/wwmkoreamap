// @ts-check

/** @type {string} */
const CHANNEL_NAME = "wwm-sync-channel";

/** @type {string} */
const tabId = Math.random().toString(36).substring(2, 15);

/** @type {BroadcastChannel|null} */
let broadcastChannel = null;

/**
 * Initializes the broadcast channel for cross-tab communication.
 * @param {Function} onDataReceived - Callback when data is received.
 * @returns {BroadcastChannel|null} The broadcast channel or null.
 */
export const initBroadcastChannel = (onDataReceived) => {
  if (typeof BroadcastChannel === "undefined") return null;

  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

  broadcastChannel.onmessage = (event) => {
    // Ignore messages from this same tab
    if (event.data?.senderId === tabId) return;

    if (event.data?.type === "SYNC_UPDATE") {
      onDataReceived?.(event.data.payload);
    }
  };

  return broadcastChannel;
};

/**
 * Broadcasts sync update to other tabs.
 * @param {any} data - The data to broadcast.
 */
export const broadcastSyncUpdate = (data) => {
  if (!broadcastChannel) return;
  broadcastChannel.postMessage({
    type: "SYNC_UPDATE",
    payload: data,
    senderId: tabId,
    timestamp: Date.now(),
  });
};

/**
 * Closes the broadcast channel.
 */
export const closeBroadcastChannel = () => {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
};
