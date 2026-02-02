// @ts-check
import { state, setState, updateState } from "../state.js";
import { BACKEND_URL } from "../config.js";
import { renderMapDataAndMarkers } from "./markers.js";
import { setVoteCache } from "../votes.js";

const BOUNDARY_STONE_NAME = "경계석"; // OR "Boundary Stone"

/**
 * Fetch community markers from backend
 */
export const fetchCommunityMarkers = async () => {
    try {
        const mapId = state.currentMapKey || "qinghe";
        const response = await fetch(`${BACKEND_URL}/api/markers?mapId=${mapId}`); // Fetch all markers (approved & pending) for this map
        const data = await response.json();

        if (data.success && Array.isArray(data.markers)) {
            const newMap = new Map();
            data.markers.forEach(m => {
                // Map backend data to frontend MapItem structure
                newMap.set(String(m.id), {
                    id: String(m.id),
                    name: m.title,
                    description: m.description,
                    category: m.type,
                    lat: parseFloat(m.lat),
                    lng: parseFloat(m.lng),
                    isBackend: true, // Marker to identify backend items
                    images: m.screenshot ? [m.screenshot] : [],
                    video_url: m.video ? [m.video] : [],
                    votes: m.votes,
                    user_id: m.userId,
                    region: m.region,
                    status: m.status // "pending", "approved", "rejected"
                });

                // Populate vote cache immediately so UI renders correct counts
                if (m.votes) {
                    setVoteCache(String(m.id), m.votes);
                }
            });

            setState("communityMarkers", newMap);
            console.log(`Loaded ${newMap.size} community markers.`);
        }
    } catch (e) {
        console.error("Failed to load community markers:", e);
    }
};

/**
 * Fetch user's completed community markers
 */
export const fetchUserCompletions = async () => {
    // Rely on httpOnly cookies for auth
    try {
        const response = await fetch(`${BACKEND_URL}/api/markers/completed`, {
            credentials: "include"
        });
        if (response.status === 401) return; // Not logged in

        const data = await response.json();
        if (data.success && Array.isArray(data.completions)) {
            const currentIds = new Set(state.completedList.map(c => String(c.id)));
            let addedCount = 0;

            data.completions.forEach(c => {
                if (!currentIds.has(String(c.id))) {
                    state.completedList.push({ id: String(c.id), completedAt: new Date(c.completedAt).getTime() });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                console.log(`[Community] Synced ${addedCount} completions from backend.`);
            }
        }
    } catch (e) {
        console.warn("[Community] Failed to fetch completions:", e);
    }
};

/**
 * Toggle Community Mode
 */
export const toggleCommunityMode = async () => {
    const isEnabled = !state.showCommunityMarkers;

    // Toggle state
    setState("showCommunityMarkers", isEnabled);

    if (isEnabled) {
        // If enabling, ensure markers are fetched
        if (state.communityMarkers.size === 0) {
            await fetchCommunityMarkers();
            await fetchUserCompletions(); // Sync completions
        } else {
            await fetchUserCompletions(); // Always sync when toggling on
        }
    }

    // Trigger map re-render
    await renderMapDataAndMarkers();

    // Update button visual state (handled in main.js or here via event)
    updateCommunityButtonState(isEnabled);
};

const updateCommunityButtonState = (isEnabled) => {
    const btns = [
        document.getElementById("community-mode-toggle"),
        document.getElementById("community-mode-toggle-top")
    ];

    btns.forEach(btn => {
        if (btn) {
            if (isEnabled) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        }
    });
};

/**
 * Get Boundary Stone Category ID dynamically
 */
export const getBoundaryStoneId = () => {
    const mapData = state.mapData;
    if (!mapData || !mapData.categories) return null;

    // Look for category with name "경계석"
    // Using t() might be needed if names are keys, but assuming name property is localized or key
    // Checking both name and translation key just in case
    const match = mapData.categories.find(c => c.name === BOUNDARY_STONE_NAME || c.name === "Boundary Stone");
    if (match) return match.id;

    // Fallback: If not found, try to search in translation values if possible, or returned known ID if Hardcoded
    // For now returning known ID if we found it in logs previously, otherwise null
    return "17310010083"; // Correct ID for Boundary Stone (Location/Region)
};
