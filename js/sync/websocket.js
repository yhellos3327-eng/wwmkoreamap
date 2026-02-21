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
 * 백엔드 URL에서 WebSocket URL을 가져옵니다.
 * @returns {string} WebSocket URL.
 */
const getWsUrl = () => {
  const url = new URL(BACKEND_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/ws/sync`;
};

/**
 * WebSocket 서버에 연결합니다.
 * @param {string} userId - 사용자 ID.
 * @param {Function} onMessage - 메시지 핸들러 콜백.
 * @returns {WebSocket|null} WebSocket 또는 null.
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
 * WebSocket 서버에 재연결을 시도합니다.
 * @param {string} userId - 사용자 ID.
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
 * WebSocket을 통해 동기화 업데이트를 전송합니다.
 * @param {any} data - 전송할 데이터.
 * @returns {boolean} 메시지 전송 여부.
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
 * WebSocket 서버와의 연결을 끊습니다.
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
 * WebSocket이 연결되어 있는지 확인합니다.
 * @returns {boolean} WebSocket 연결 여부.
 */
export const isWebSocketConnected = () => socket?.readyState === WebSocket.OPEN;
