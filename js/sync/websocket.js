import { BACKEND_URL } from '../config.js';

let socket = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let messageHandler = null;

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

const getWsUrl = () => {
    const url = new URL(BACKEND_URL);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/sync`;
};

export const connectWebSocket = (userId, onMessage) => {
    if (socket?.readyState === WebSocket.OPEN) return socket;

    messageHandler = onMessage;

    try {
        socket = new WebSocket(getWsUrl());

        socket.onopen = () => {
            console.log('[WS] Connected');
            reconnectAttempts = 0;
            socket.send(JSON.stringify({ type: 'AUTH', userId }));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'SYNC_UPDATE' && messageHandler) {
                    messageHandler(data.payload);
                }
            } catch (e) {
                console.error('[WS] Parse error:', e);
            }
        };

        socket.onclose = (event) => {
            console.log('[WS] Disconnected:', event.code);
            socket = null;
            attemptReconnect(userId);
        };

        socket.onerror = (error) => {
            console.error('[WS] Error:', error);
        };

        return socket;
    } catch (error) {
        console.error('[WS] Connection failed:', error);
        return null;
    }
};

const attemptReconnect = (userId) => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('[WS] Max reconnect attempts reached');
        return;
    }

    reconnectAttempts++;
    console.log(`[WS] Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimer = setTimeout(() => {
        connectWebSocket(userId, messageHandler);
    }, RECONNECT_DELAY * reconnectAttempts);
};

export const sendSyncUpdate = (data) => {
    if (socket?.readyState !== WebSocket.OPEN) return false;

    socket.send(JSON.stringify({
        type: 'SYNC_UPDATE',
        payload: data,
        timestamp: Date.now()
    }));
    return true;
};

export const disconnectWebSocket = () => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (socket) {
        socket.close(1000, 'User logout');
        socket = null;
    }

    reconnectAttempts = 0;
    messageHandler = null;
};

export const isWebSocketConnected = () => socket?.readyState === WebSocket.OPEN;
