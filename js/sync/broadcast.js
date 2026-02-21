// @ts-check

/** @type {string} */
const CHANNEL_NAME = "wwm-sync-channel";

/** @type {string} */
const tabId = Math.random().toString(36).substring(2, 15);

/** @type {BroadcastChannel|null} */
let broadcastChannel = null;

/**
 * 탭 간 통신을 위한 브로드캐스트 채널을 초기화합니다.
 * @param {Function} onDataReceived - 데이터 수신 시 콜백.
 * @returns {BroadcastChannel|null} 브로드캐스트 채널 또는 null.
 */
export const initBroadcastChannel = (onDataReceived) => {
  if (typeof BroadcastChannel === "undefined") return null;

  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

  broadcastChannel.onmessage = (event) => {
    // 현재 탭에서 보낸 메시지는 무시
    if (event.data?.senderId === tabId) return;

    if (event.data?.type === "SYNC_UPDATE") {
      onDataReceived?.(event.data.payload);
    }
  };

  return broadcastChannel;
};

/**
 * 다른 탭으로 동기화 업데이트를 방송합니다.
 * @param {any} data - 방송할 데이터.
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
 * 브로드캐스트 채널을 닫습니다.
 */
export const closeBroadcastChannel = () => {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
};
