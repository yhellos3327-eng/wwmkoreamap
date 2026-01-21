// @ts-check
import { BACKEND_URL } from "../config.js";

/** @type {WebSocket|null} */
let socket = null;

/** @type {number} */
let reconnectAttempts = 0;

/** @type {number|null} */
let reconnectTimer = null;

/** @type {Function|null} */
let messageHandler = null;

/** @type {number} */
const MAX_RECONNECT_ATTEMPTS = 5;

/** @type {number} */
const RECONNECT_DELAY = 3000;

/**
 * Gets the WebSocket URL from the backend URL.
 * @returns {string} The WebSocket URL.
 */
const getWsUrl = () => {
  const url = new URL(BACKEND_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/ws/sync`;
};

/**
 * Connects to the WebSocket server.
 * @param {string} userId - The user ID.
 * @param {Function} onMessage - Message handler callback.
 * @returns {WebSocket|null} The WebSocket or null.
 */
export const connectWebSocket = (userId, onMessage) => {
  if (socket?.readyState === WebSocket.OPEN) return socket;

  messageHandler = onMessage;

  try {
    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      console.log("[WS] Connected");
      reconnectAttempts = 0;
      socket?.send(JSON.stringify({ type: "AUTH", userId }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "SYNC_UPDATE" && messageHandler) {
          messageHandler(data.payload);
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    socket.onclose = (event) => {
      console.log("[WS] Disconnected:", event.code);
      socket = null;
      attemptReconnect(userId);
    };

    socket.onerror = (error) => {
      console.error("[WS] Error:", error);
    };

    return socket;
  } catch (error) {
    console.error("[WS] Connection failed:", error);
    return null;
  }
};

/**
 * Attempts to reconnect to the WebSocket server.
 * @param {string} userId - The user ID.
 */
const attemptReconnect = (userId) => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("[WS] Max reconnect attempts reached");
    return;
  }

  reconnectAttempts++;
  console.log(
    `[WS] Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
  );

  reconnectTimer = window.setTimeout(() => {
    connectWebSocket(userId, messageHandler);
  }, RECONNECT_DELAY * reconnectAttempts);
};

/**
 * Sends a sync update through the WebSocket.
 * @param {any} data - The data to send.
 * @returns {boolean} Whether the message was sent.
 */
export const sendSyncUpdate = (data) => {
  if (socket?.readyState !== WebSocket.OPEN) return false;

  socket.send(
    JSON.stringify({
      type: "SYNC_UPDATE",
      payload: data,
      timestamp: Date.now(),
    }),
  );
  return true;
};

/**
 * Disconnects from the WebSocket server.
 */
export const disconnectWebSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.close(1000, "User logout");
    socket = null;
  }

  reconnectAttempts = 0;
  messageHandler = null;
};

/**
 * Checks if the WebSocket is connected.
 * @returns {boolean} Whether the WebSocket is connected.
 */
export const isWebSocketConnected = () => socket?.readyState === WebSocket.OPEN;
