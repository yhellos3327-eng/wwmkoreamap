const CHANNEL_NAME = 'wwm-sync-channel';
let broadcastChannel = null;

export const initBroadcastChannel = (onDataReceived) => {
    if (typeof BroadcastChannel === 'undefined') return null;

    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

    broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_UPDATE') {
            onDataReceived?.(event.data.payload);
        }
    };

    return broadcastChannel;
};

export const broadcastSyncUpdate = (data) => {
    if (!broadcastChannel) return;
    broadcastChannel.postMessage({
        type: 'SYNC_UPDATE',
        payload: data,
        timestamp: Date.now()
    });
};

export const closeBroadcastChannel = () => {
    if (broadcastChannel) {
        broadcastChannel.close();
        broadcastChannel = null;
    }
};
