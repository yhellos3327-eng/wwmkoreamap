// @ts-check
/// <reference path="./types.d.ts" />
const STORAGE_COUNTS_KEY = "wwm_votes_counts";
const STORAGE_USER_KEY = "wwm_user_votes";

const votesCache = new Map();

/**
 * Gets the API base URL based on environment.
 * @returns {string} The API base URL.
 */
const getApiBaseUrl = () => {
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:3000/api";
  }
  return "https://api.wwmmap.kr/api";
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Gets cached or local vote counts for an item.
 * @param {string|number} itemId - The item ID.
 * @returns {{up: number, down: number}} The vote counts.
 */
export const getVoteCounts = (itemId) => {
  if (votesCache.has(itemId)) {
    return votesCache.get(itemId);
  }
  const storage = JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
  return storage[itemId] || { up: 0, down: 0 };
};

/**
 * Gets the user's vote for an item.
 * @param {string|number} itemId - The item ID.
 * @returns {string|null} The vote type ('up', 'down') or null.
 */
export const getUserVote = (itemId) => {
  // Check cache first if available (populated by batch fetch)
  if (votesCache.has(itemId) && votesCache.get(itemId).userVote !== undefined) {
    return votesCache.get(itemId).userVote;
  }
  const storage = JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};
  return storage[itemId] || null;
};

/**
 * Fetches vote counts for an item from the API.
 * @param {string|number} itemId - The item ID.
 * @returns {Promise<{up: number, down: number}>} The vote counts.
 */
export const fetchVoteCounts = async (itemId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/votes/${itemId}`);
    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    const counts = {
      up: data.up || 0,
      down: data.down || 0,
      userVote: data.userVote,
    };

    votesCache.set(itemId, counts);

    // Update local storage for persistence/offline
    const storageCounts =
      JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
    storageCounts[itemId] = { up: counts.up, down: counts.down };
    localStorage.setItem(STORAGE_COUNTS_KEY, JSON.stringify(storageCounts));

    if (data.userVote !== undefined) {
      const storageUser =
        JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};
      if (data.userVote) {
        storageUser[itemId] = data.userVote;
      } else {
        delete storageUser[itemId];
      }
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(storageUser));
    }

    updateVoteUI(itemId, counts);
    return counts;
  } catch (error) {}
  return getVoteCounts(itemId);
};

/**
 * Fetches vote counts for multiple items in a batch.
 * @param {Array<string|number>} itemIds - The item IDs.
 * @returns {Promise<Object>} The vote data by item ID.
 */
export const fetchBatchVotes = async (itemIds) => {
  if (!itemIds || itemIds.length === 0) return {};
  try {
    const response = await fetch(`${API_BASE_URL}/votes/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds }),
    });
    if (!response.ok) throw new Error("Batch fetch failed");

    const data = await response.json();

    const storageCounts =
      JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
    const storageUser =
      JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};

    Object.keys(data).forEach((itemId) => {
      const itemData = data[itemId];
      const counts = {
        up: itemData.up,
        down: itemData.down,
        userVote: itemData.userVote,
      };
      votesCache.set(itemId, counts);

      storageCounts[itemId] = { up: counts.up, down: counts.down };

      if (itemData.userVote) {
        storageUser[itemId] = itemData.userVote;
      } else {
        delete storageUser[itemId];
      }
    });

    localStorage.setItem(STORAGE_COUNTS_KEY, JSON.stringify(storageCounts));
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(storageUser));

    return data;
  } catch (error) {
    console.error("Batch vote fetch error:", error);
    return {};
  }
};

/**
 * Toggles a vote for an item.
 * @param {string|number} itemId - The item ID.
 * @param {string} type - The vote type ('up' or 'down').
 * @returns {Promise<{counts: {up: number, down: number}, userVote: string|null}>} The new vote state.
 */
export const toggleVote = async (itemId, type) => {
  // Optimistic UI update
  const currentCounts = getVoteCounts(itemId);
  const currentUserVote = getUserVote(itemId);

  let newCounts = { ...currentCounts };
  let newUserVote = type;

  if (currentUserVote === type) {
    newCounts[type] = Math.max(0, newCounts[type] - 1);
    newUserVote = null;
  } else {
    if (currentUserVote) {
      newCounts[currentUserVote] = Math.max(0, newCounts[currentUserVote] - 1);
    }
    newCounts[type]++;
  }

  // Update UI immediately
  updateVoteUI(itemId, { ...newCounts, userVote: newUserVote });

  try {
    const response = await fetch(`${API_BASE_URL}/votes/${itemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    if (!response.ok) throw new Error("Vote failed");

    const data = await response.json();
    const finalCounts = {
      up: data.up,
      down: data.down,
      userVote: data.userVote,
    };

    votesCache.set(itemId, finalCounts);

    // Sync storage
    const storageCounts =
      JSON.parse(localStorage.getItem(STORAGE_COUNTS_KEY)) || {};
    storageCounts[itemId] = { up: finalCounts.up, down: finalCounts.down };
    localStorage.setItem(STORAGE_COUNTS_KEY, JSON.stringify(storageCounts));

    const storageUser =
      JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || {};
    if (finalCounts.userVote) {
      storageUser[itemId] = finalCounts.userVote;
    } else {
      delete storageUser[itemId];
    }
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(storageUser));

    updateVoteUI(itemId, finalCounts);

    return { counts: finalCounts, userVote: finalCounts.userVote };
  } catch (error) {
    console.error("Vote error:", error);
    // Revert UI on error (simplified: just fetch again)
    fetchVoteCounts(itemId);
    return { counts: currentCounts, userVote: currentUserVote };
  }
};

/**
 * Updates the vote UI for an item.
 * @param {string|number} itemId - The item ID.
 * @param {{up: number, down: number, userVote?: string}} data - The vote data.
 */
const updateVoteUI = (itemId, data) => {
  // Handle both map popup votes and comment votes
  const containers = document.querySelectorAll(
    `.vote-container[data-item-id="${itemId}"]`,
  );

  containers.forEach((container) => {
    const upBtn = container.querySelector(".btn-up");
    const downBtn = container.querySelector(".btn-down");
    const upCount = upBtn.querySelector(".vote-count");
    const downCount = downBtn.querySelector(".vote-count");

    if (upCount) upCount.textContent = String(data.up);
    if (downCount) downCount.textContent = String(data.down);

    if (upBtn) upBtn.classList.toggle("active", data.userVote === "up");
    if (downBtn) downBtn.classList.toggle("active", data.userVote === "down");
  });
};

/**
 * Renders vote buttons HTML for an item.
 * @param {string|number} itemId - The item ID.
 * @param {boolean} [small=false] - Whether to use small button style.
 * @returns {string} The HTML string.
 */
export const renderVoteButtons = (itemId, small = false) => {
  const counts = getVoteCounts(itemId);
  const userVote = getUserVote(itemId);

  const sizeClass = small ? "vote-small" : "";

  return `
        <div class="vote-container ${sizeClass}" data-item-id="${itemId}">
            ${!small ? '<span class="vote-label">이 정보가 유용한가요?</span>' : ""}
            <div class="vote-buttons">
                <button class="btn-vote btn-up ${userVote === "up" ? "active" : ""}" data-action="vote" data-type="up" data-item-id="${itemId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span class="vote-count">${counts.up}</span>
                </button>
                <button class="btn-vote btn-down ${userVote === "down" ? "active" : ""}" data-action="vote" data-type="down" data-item-id="${itemId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span class="vote-count">${counts.down}</span>
                </button>
            </div>
        </div>
    `;
};
