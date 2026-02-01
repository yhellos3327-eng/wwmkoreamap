// @ts-check
/// <reference path="./types.d.ts" />
const STORAGE_COUNTS_KEY = "wwm_votes_counts";
const STORAGE_USER_KEY = "wwm_user_votes";

const votesCache = new Map();
let isVotesInitialized = false;

export const initVotes = async () => {
  if (isVotesInitialized) return;
  try {
    const { primaryDb } = await import("./storage/db.js");
    const [counts, userVotes] = await Promise.all([
      primaryDb.get(STORAGE_COUNTS_KEY),
      primaryDb.get(STORAGE_USER_KEY)
    ]);

    if (counts) {
      Object.entries(counts).forEach(([id, data]) => {
        const current = votesCache.get(id) || { up: 0, down: 0 };
        votesCache.set(id, { ...current, ...data });
      });
    }

    if (userVotes) {
      Object.entries(userVotes).forEach(([id, vote]) => {
        const current = votesCache.get(id) || { up: 0, down: 0 };
        votesCache.set(id, { ...current, userVote: vote });
      });
    }
    isVotesInitialized = true;
  } catch (e) {
    console.warn("Failed to init votes from DB", e);
  }
};

/**
 * Gets the API base URL based on environment.
 * @returns {string} The API base URL.
 */
const getApiBaseUrl = () => {
  // For local testing with production API (no CORS issues since credentials are included)
  // To use local backend: uncomment below and run `node backend/index.js`
  // if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  //   return "http://localhost:3000/api";
  // }
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
  return votesCache.get(itemId) || { up: 0, down: 0 };
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
  return votesCache.get(itemId)?.userVote || null;
};

/**
 * Fetches vote counts for an item from the API.
 * @param {string|number} itemId - The item ID.
 * @returns {Promise<{up: number, down: number}>} The vote counts.
 */
export const fetchVoteCounts = async (itemId, isBackend = false) => {
  try {
    const endpoint = isBackend
      ? `${API_BASE_URL}/markers/${itemId}/votes`
      : `${API_BASE_URL}/votes/${itemId}`;

    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    const counts = {
      up: data.up || 0,
      down: data.down || 0,
      userVote: data.userVote,
    };

    votesCache.set(itemId, counts);

    // Update DB asynchronously
    import("./storage/db.js").then(async ({ primaryDb }) => {
      try {
        const storageCounts = await primaryDb.get(STORAGE_COUNTS_KEY) || {};
        storageCounts[itemId] = { up: counts.up, down: counts.down };
        await primaryDb.set(STORAGE_COUNTS_KEY, storageCounts);

        if (data.userVote !== undefined) {
          const storageUser = await primaryDb.get(STORAGE_USER_KEY) || {};
          if (data.userVote) {
            storageUser[itemId] = data.userVote;
          } else {
            delete storageUser[itemId];
          }
          await primaryDb.set(STORAGE_USER_KEY, storageUser);
        }
      } catch (e) {
        console.warn("Failed to save vote to DB", e);
      }
    });

    updateVoteUI(itemId, counts);
    return counts;
  } catch (error) {
    console.warn(`Failed to fetch vote counts for item ${itemId}:`, error);
  }
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
    console.log("[Votes] Fetching batch votes for:", itemIds);
    const response = await fetch(`${API_BASE_URL}/markers/votes/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ itemIds: itemIds.map((id) => String(id)) }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Votes] Batch fetch failed:", response.status, errorData);
      throw new Error("Batch fetch failed");
    }

    const data = await response.json();

    // Update DB asynchronously
    import("./storage/db.js").then(async ({ primaryDb }) => {
      try {
        const storageCounts = await primaryDb.get(STORAGE_COUNTS_KEY) || {};
        const storageUser = await primaryDb.get(STORAGE_USER_KEY) || {};

        Object.keys(data).forEach((itemId) => {
          const itemData = data[itemId];
          storageCounts[itemId] = { up: itemData.up, down: itemData.down };
          if (itemData.userVote) {
            storageUser[itemId] = itemData.userVote;
          } else {
            delete storageUser[itemId];
          }
        });

        await primaryDb.setMultiple([
          { key: STORAGE_COUNTS_KEY, value: storageCounts },
          { key: STORAGE_USER_KEY, value: storageUser }
        ]);
      } catch (e) {
        console.warn("Failed to save batch votes to DB", e);
      }
    });

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
export const toggleVote = async (itemId, type, isBackend = false) => {
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
    console.log("[Votes] Sending vote:", itemId, type);

    // Map 'report' to 'down' if needed, or keep as is.
    // Backend markers expect 'report' or 'up'. Standard votes expect 'up' or 'down'.
    // If standard vote receives 'report', it might fail if not handled.
    // Standard votes.js (backend) checks for ["up", "down"].

    let dbType = type;

    const endpoint = isBackend
      ? `${API_BASE_URL}/markers/${itemId}/vote`
      : `${API_BASE_URL}/votes/${itemId}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Votes] Vote failed:", response.status, errorData);
      throw new Error("Vote failed");
    }

    const data = await response.json();
    const finalCounts = {
      up: data.up,
      down: data.down,
      userVote: data.userVote,
    };

    votesCache.set(itemId, finalCounts);

    // Sync storage asynchronously
    import("./storage/db.js").then(async ({ primaryDb }) => {
      try {
        const storageCounts = await primaryDb.get(STORAGE_COUNTS_KEY) || {};
        storageCounts[itemId] = { up: finalCounts.up, down: finalCounts.down };

        const storageUser = await primaryDb.get(STORAGE_USER_KEY) || {};
        if (finalCounts.userVote) {
          storageUser[itemId] = finalCounts.userVote;
        } else {
          delete storageUser[itemId];
        }

        await primaryDb.setMultiple([
          { key: STORAGE_COUNTS_KEY, value: storageCounts },
          { key: STORAGE_USER_KEY, value: storageUser }
        ]);
      } catch (e) {
        console.warn("Failed to save vote toggle to DB", e);
      }
    });

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
export const renderVoteButtons = (itemId, small = false, isBackend = false) => {
  const counts = getVoteCounts(itemId);
  const userVote = getUserVote(itemId);

  const sizeClass = small ? "vote-small" : "";

  // For backend markers, use 'report' (신고), for others use 'down' (비추천 is rarely used but generic)
  const downType = isBackend ? "report" : "down";
  const downTitle = isBackend ? "신고 (부적절한 위치/내용)" : "비추천";
  const downIconColor = isBackend ? "color: #ff6b6b;" : "";
  const activeClass = userVote === downType ? "active" : "";

  return `
        <div class="vote-container ${sizeClass}" data-item-id="${itemId}" data-is-backend="${isBackend}">
            ${!small ? '<span class="vote-label">이 정보가 유용한가요?</span>' : ""}
            <div class="vote-buttons">
                <button class="btn-vote btn-up ${userVote === "up" ? "active" : ""}" data-action="vote" data-type="up" data-item-id="${itemId}" data-is-backend="${isBackend}" title="추천" style="gap:4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span class="vote-count">${counts.up}</span>
                </button>
                <button class="btn-vote btn-down ${activeClass}" data-action="vote" data-type="${downType}" data-item-id="${itemId}" data-is-backend="${isBackend}" title="${downTitle}" style="gap:4px; ${downIconColor}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                    <span class="vote-count">${counts.down}</span>
                </button>
            </div>
        </div>
    `;
};
