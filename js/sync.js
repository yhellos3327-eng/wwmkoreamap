/**
 * Cloud Sync Module
 * Handles synchronization of user data (completed markers, favorites) with the server
 */

import { BACKEND_URL } from './config.js';
import { isLoggedIn, getCurrentUser } from './auth.js';

let syncTimeout = null;
let isSyncing = false;
const SYNC_DELAY = 2000; // 2 seconds debounce

// Create sync tooltip element
const createSyncTooltip = () => {
    let tooltip = document.getElementById('sync-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'sync-tooltip';
        tooltip.innerHTML = `
            <span class="sync-spinner">⟳</span>
            <span class="sync-text">동기화중...</span>
        `;
        tooltip.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 10000;
            display: none;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(5px);
        `;

        // Add spinner animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes sync-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            #sync-tooltip .sync-spinner {
                display: inline-block;
                animation: sync-spin 1s linear infinite;
                font-size: 16px;
            }
            #sync-tooltip.sync-success {
                background: rgba(40, 167, 69, 0.9);
            }
            #sync-tooltip.sync-error {
                background: rgba(220, 53, 69, 0.9);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(tooltip);
    }
    return tooltip;
};

const showSyncTooltip = (message = '동기화중...', type = 'syncing') => {
    const tooltip = createSyncTooltip();
    const spinner = tooltip.querySelector('.sync-spinner');
    const text = tooltip.querySelector('.sync-text');

    tooltip.className = '';
    if (type === 'success') {
        tooltip.classList.add('sync-success');
        spinner.textContent = '✓';
        spinner.style.animation = 'none';
    } else if (type === 'error') {
        tooltip.classList.add('sync-error');
        spinner.textContent = '✕';
        spinner.style.animation = 'none';
    } else {
        spinner.textContent = '⟳';
        spinner.style.animation = 'sync-spin 1s linear infinite';
    }

    text.textContent = message;
    tooltip.style.display = 'flex';
};

const hideSyncTooltip = (delay = 0) => {
    setTimeout(() => {
        const tooltip = document.getElementById('sync-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }, delay);
};

// Get current data from localStorage
const getLocalData = () => {
    let completedMarkers = [];
    let favorites = [];
    let settings = {};

    // Get completed markers (stored as JSON array in 'wwm_completed')
    const completedData = localStorage.getItem('wwm_completed');
    if (completedData) {
        try {
            completedMarkers = JSON.parse(completedData) || [];
        } catch (e) {
            console.error('Failed to parse completed markers:', e);
        }
    }

    // Get favorites (try multiple possible keys)
    const favoritesData = localStorage.getItem('wwm_favorites') ||
        localStorage.getItem('wwm_favorites_qinghe') ||
        localStorage.getItem('wwm_favorites_kaifeng');
    if (favoritesData) {
        try {
            favorites = JSON.parse(favoritesData) || [];
        } catch (e) {
            console.error('Failed to parse favorites:', e);
        }
    }

    // Get settings (except API keys)
    settings = {
        showComments: localStorage.getItem('wwm_show_comments'),
        closeOnComplete: localStorage.getItem('wwm_close_on_complete'),
        hideCompleted: localStorage.getItem('wwm_hide_completed'),
        enableClustering: localStorage.getItem('wwm_enable_clustering'),
        showAd: localStorage.getItem('wwm_show_ad'),
        regionColor: localStorage.getItem('wwm_region_color'),
        regionFillColor: localStorage.getItem('wwm_region_fill_color'),
        gpuMode: localStorage.getItem('wwm_gpu_mode'),
        // Map-specific active categories/regions
        activeCatsQinghe: localStorage.getItem('wwm_active_cats_qinghe'),
        activeCatsKaifeng: localStorage.getItem('wwm_active_cats_kaifeng'),
        activeRegsQinghe: localStorage.getItem('wwm_active_regs_qinghe'),
        activeRegsKaifeng: localStorage.getItem('wwm_active_regs_kaifeng'),
        favoritesQinghe: localStorage.getItem('wwm_favorites_qinghe'),
        favoritesKaifeng: localStorage.getItem('wwm_favorites_kaifeng')
    };

    // Clean up null values
    Object.keys(settings).forEach(key => {
        if (settings[key] === null) delete settings[key];
    });

    return { completedMarkers, favorites, settings };
};

// Save data to localStorage
const setLocalData = (data) => {
    if (!data) return;

    // Set completed markers
    if (data.completedMarkers) {
        localStorage.setItem('wwm_completed', JSON.stringify(data.completedMarkers));
    }

    // Set favorites
    if (data.favorites) {
        localStorage.setItem('wwm_favorites', JSON.stringify(data.favorites));
    }

    // Set settings (except API keys)
    if (data.settings) {
        const s = data.settings;
        if (s.showComments !== undefined) localStorage.setItem('wwm_show_comments', s.showComments);
        if (s.closeOnComplete !== undefined) localStorage.setItem('wwm_close_on_complete', s.closeOnComplete);
        if (s.hideCompleted !== undefined) localStorage.setItem('wwm_hide_completed', s.hideCompleted);
        if (s.enableClustering !== undefined) localStorage.setItem('wwm_enable_clustering', s.enableClustering);
        if (s.showAd !== undefined) localStorage.setItem('wwm_show_ad', s.showAd);
        if (s.regionColor !== undefined) localStorage.setItem('wwm_region_color', s.regionColor);
        if (s.regionFillColor !== undefined) localStorage.setItem('wwm_region_fill_color', s.regionFillColor);
        if (s.gpuMode !== undefined) localStorage.setItem('wwm_gpu_mode', s.gpuMode);
        // Map-specific
        if (s.activeCatsQinghe !== undefined) localStorage.setItem('wwm_active_cats_qinghe', s.activeCatsQinghe);
        if (s.activeCatsKaifeng !== undefined) localStorage.setItem('wwm_active_cats_kaifeng', s.activeCatsKaifeng);
        if (s.activeRegsQinghe !== undefined) localStorage.setItem('wwm_active_regs_qinghe', s.activeRegsQinghe);
        if (s.activeRegsKaifeng !== undefined) localStorage.setItem('wwm_active_regs_kaifeng', s.activeRegsKaifeng);
        if (s.favoritesQinghe !== undefined) localStorage.setItem('wwm_favorites_qinghe', s.favoritesQinghe);
        if (s.favoritesKaifeng !== undefined) localStorage.setItem('wwm_favorites_kaifeng', s.favoritesKaifeng);
    }
};

// Save to server
export const saveToCloud = async () => {
    if (!isLoggedIn()) {
        console.log('[Sync] Not logged in, skipping save');
        return false;
    }

    if (isSyncing) {
        console.log('[Sync] Already syncing, skipping');
        return false;
    }

    isSyncing = true;
    showSyncTooltip('동기화중...');

    try {
        const data = getLocalData();

        const response = await fetch(`${BACKEND_URL}/api/sync/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save');
        }

        const result = await response.json();
        console.log('[Sync] Save successful:', result);

        showSyncTooltip('동기화 완료!', 'success');
        hideSyncTooltip(1500);

        return true;
    } catch (error) {
        console.error('[Sync] Save failed:', error);
        showSyncTooltip('동기화 실패', 'error');
        hideSyncTooltip(2000);
        return false;
    } finally {
        isSyncing = false;
    }
};

// Load from server
export const loadFromCloud = async () => {
    if (!isLoggedIn()) {
        console.log('[Sync] Not logged in, skipping load');
        return null;
    }

    showSyncTooltip('데이터 불러오는 중...');

    try {
        const response = await fetch(`${BACKEND_URL}/api/sync/load`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load');
        }

        const result = await response.json();

        if (result.success && result.data) {
            console.log('[Sync] Load successful:', result.data);
            setLocalData(result.data);
            showSyncTooltip('데이터 불러오기 완료!', 'success');
            hideSyncTooltip(1500);
            return result.data;
        } else {
            console.log('[Sync] No cloud data found');
            hideSyncTooltip(0);
            return null;
        }
    } catch (error) {
        console.error('[Sync] Load failed:', error);
        showSyncTooltip('불러오기 실패', 'error');
        hideSyncTooltip(2000);
        return null;
    }
};

// Debounced save - call this when data changes
export const triggerSync = () => {
    if (!isLoggedIn()) return;

    // Clear existing timeout
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    // Set new timeout for debounced save
    syncTimeout = setTimeout(() => {
        saveToCloud();
    }, SYNC_DELAY);
};

// Initialize sync on login
export const initSync = async () => {
    if (!isLoggedIn()) {
        console.log('[Sync] Not logged in, sync disabled');
        return;
    }

    console.log('[Sync] Initializing sync for user:', getCurrentUser()?.name);

    // Load data from cloud on login
    const cloudData = await loadFromCloud();

    if (cloudData) {
        // Trigger a page refresh or event to update UI with loaded data
        window.dispatchEvent(new CustomEvent('syncDataLoaded', { detail: cloudData }));
    }
};
