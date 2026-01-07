const STORAGE_COUNTS_KEY = 'wwm_votes_counts';
const STORAGE_USER_KEY = 'wwm_user_votes';

const votesCache = new Map();

const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return 'https://api.wwmmap.kr/api';
};

const API_BASE_URL = getApiBaseUrl();

export const getVoteCounts = (itemId) => {
    if (votesCache.has(itemId)) {
        return votesCache.get(itemId);
    }
    const storage = JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
    return storage[itemId] || { up: 0, down: 0 };
};

export const getUserVote = (itemId) => {
    const storage = JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};
    return storage[itemId] || null;
};

export const fetchVoteCounts = async (itemId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/votes/${itemId}`);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const counts = { up: data.up || 0, down: data.down || 0 };

        votesCache.set(itemId, counts);

        const storage = JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
        storage[itemId] = counts;
        localStorage.setItem(STORAGE_COUNTS_KEY, JSON.stringify(storage));

        updateVoteUI(itemId, counts);
        return counts;
    } catch (error) { }
    return getVoteCounts(itemId);
};

export const toggleVote = async (itemId, type) => {
    const userStorage = JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};
    const currentVote = userStorage[itemId];

    let counts = { ...getVoteCounts(itemId) };
    let incrementVal = 0;
    let requestType = type;

    if (currentVote === type) {
        counts[type]--;
        delete userStorage[itemId];
        incrementVal = -1;
    } else {
        if (currentVote) {
            counts[currentVote]--;
        }
        counts[type]++;
        userStorage[itemId] = type;
        incrementVal = 1;
    }

    if (counts.up < 0) counts.up = 0;
    if (counts.down < 0) counts.down = 0;

    const storageCounts = JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
    storageCounts[itemId] = counts;
    localStorage.setItem(STORAGE_COUNTS_KEY, JSON.stringify(storageCounts));
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userStorage));
    votesCache.set(itemId, counts);

    updateServerVotes(itemId, type, incrementVal, currentVote);

    return {
        counts,
        userVote: userStorage[itemId]
    };
};

const updateServerVotes = async (itemId, type, incrementVal, previousVote) => {
    try {
        if (previousVote && previousVote !== type && incrementVal === 1) {
            await fetch(`${API_BASE_URL}/votes/${itemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: previousVote, increment: -1 })
            });
            await fetch(`${API_BASE_URL}/votes/${itemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type, increment: 1 })
            });
        } else {
            await fetch(`${API_BASE_URL}/votes/${itemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type, increment: incrementVal })
            });
        }
    } catch (error) {
        console.error("Failed to update server votes:", error);
    }
};

const updateVoteUI = (itemId, counts) => {
    const container = document.querySelector(`.vote-container[data-item-id="${itemId}"]`);
    if (!container) return;

    const upCount = container.querySelector('.btn-up .vote-count');
    const downCount = container.querySelector('.btn-down .vote-count');

    if (upCount) upCount.textContent = counts.up;
    if (downCount) downCount.textContent = counts.down;
};

export const renderVoteButtons = (itemId) => {
    const counts = getVoteCounts(itemId);
    const userVote = getUserVote(itemId);

    return `
        <div class="vote-container" data-item-id="${itemId}">
            <span class="vote-label">이 정보가 유용한가요?</span>
            <div class="vote-buttons">
                <button class="btn-vote btn-up ${userVote === 'up' ? 'active' : ''}" data-action="vote" data-type="up" data-item-id="${itemId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span class="vote-count">${counts.up}</span>
                </button>
                <button class="btn-vote btn-down ${userVote === 'down' ? 'active' : ''}" data-action="vote" data-type="down" data-item-id="${itemId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span class="vote-count">${counts.down}</span>
                </button>
            </div>
        </div>
    `;
};
