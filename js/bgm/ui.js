// @ts-check

/**
 * @fileoverview BGM Player UI — 사이드바 하단 오디오 바
 */

import {
  initYTPlayer, isReady, togglePlay, pause, next, prev,
  setVolume, toggleMute, seekTo, onStateChange,
  bgmState, getCurrentTrack, getPlaylist, setTrack,
  toggleShuffle, toggleRepeat
} from "./player.js";
import { state as appState } from "../state.js";

// ─── SVG Icons ────────────────────────────────────────────────
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
const ICON_PREV = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="2" height="16"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="2" height="16"/></svg>`;
const ICON_VOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>`;
const ICON_MUTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
const ICON_LIST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
const ICON_SHUFFLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`;
const ICON_REPEAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
const ICON_REPEAT_ONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><path d="M11 10h1v4"></path></svg>`;

// ─── DOM References ───────────────────────────────────────────
/** @type {HTMLElement|null} */
let _bar = null;
let _playBtn = null;
let _titleEl = null;
let _progressFill = null;
let _progressBar = null;
let _volumeSlider = null;
let _volBtn = null;
let _timeEl = null;
let _playlistContainer = null;
let _playlistBtn = null;
let _playlistPanel = null;
let _videoPreview = null;

// ─── Public ───────────────────────────────────────────────────

/**
 * BGM 플레이어 표시/숨김
 * @param {boolean} visible
 */
export const setBgmPlayerVisible = (visible) => {
  const bar = document.getElementById("audio-bar");
  if (bar) bar.style.display = visible ? "" : "none";

  if (!visible) {
    pause();
  }
};

/**
 * BGM 플레이어 초기화 — DOM 생성 + YT API 로드
 */
export const initBgmPlayer = () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || document.getElementById("audio-bar")) return;

  _createDOM(sidebar);
  _bindEvents();

  // 설정에 따라 초기 표시 여부 적용
  if (appState.showBgmPlayer === false) {
    setBgmPlayerVisible(false);
  }

  // YT API 비동기 로드 (실패해도 크래시 안 함)
  initYTPlayer().then(() => {
    if (_playBtn) _playBtn.disabled = false;
    _updateUI(bgmState);
  }).catch((err) => {
    console.warn("[BGM] YT API load failed:", err);
  });

  onStateChange(_updateUI);
};

// ─── DOM Creation ─────────────────────────────────────────────

/** @param {Element} sidebar */
const _createDOM = (sidebar) => {
  _bar = document.createElement("div");
  _bar.id = "audio-bar";
  _bar.className = "audio-bar";
  _bar.innerHTML = `
    <!-- Video Preview Hover -->
    <div id="bgm-video-preview" class="bgm-video-preview">
        <!-- YT Iframe will be moved here by script -->
    </div>

    <!-- Playlist Panel -->
    <div id="bgm-playlist-panel" class="bgm-playlist-panel">
        <div class="bgm-playlist-header">
            <span>Playlist</span>
            <button class="bgm-close-list" id="bgm-close-list">×</button>
        </div>
        <div id="bgm-playlist-container" class="bgm-playlist-container"></div>
    </div>

    <div class="audio-bar-progress" id="bgm-progress-bar">
      <div class="audio-bar-progress-fill" id="bgm-progress-fill"></div>
    </div>
    <div class="audio-bar-content">
      <div class="audio-bar-info">
        <div class="audio-bar-meta">
            <span class="audio-bar-title" id="bgm-title">BGM Player</span>
            <span class="audio-bar-time" id="bgm-time">0:00</span>
        </div>
      </div>
      <div class="audio-bar-controls">
        <div class="audio-control-main">
            <button class="audio-btn" id="bgm-prev" title="이전">${ICON_PREV}</button>
            <button class="audio-btn audio-btn-play" id="bgm-play" title="재생" disabled>${ICON_PLAY}</button>
            <button class="audio-btn" id="bgm-next" title="다음">${ICON_NEXT}</button>
        </div>
        <div class="audio-control-side">
            <button class="audio-btn" id="bgm-shuffle" title="순서 섞기">${ICON_SHUFFLE}</button>
            <button class="audio-btn" id="bgm-repeat" title="반복 설정">${ICON_REPEAT}</button>
            <button class="audio-btn" id="bgm-list-btn" title="재생 목록">${ICON_LIST}</button>
            <div class="audio-vol-group">
                <button class="audio-btn audio-btn-vol" id="bgm-vol-btn" title="음량">${ICON_VOL}</button>
                <div class="audio-vol-popover">
                    <span class="audio-vol-percent" id="bgm-vol-percent">${bgmState.volume}%</span>
                    <input type="range" class="audio-volume-slider" id="bgm-volume" min="0" max="100" value="${bgmState.volume}">
                </div>
            </div>
        </div>
      </div>
    </div>
  `;
  sidebar.appendChild(_bar);

  _playBtn = document.getElementById("bgm-play");
  _titleEl = document.getElementById("bgm-title");
  _progressFill = document.getElementById("bgm-progress-fill");
  _progressBar = document.getElementById("bgm-progress-bar");
  _volumeSlider = /** @type {HTMLInputElement} */ (document.getElementById("bgm-volume"));
  _volBtn = document.getElementById("bgm-vol-btn");
  _timeEl = document.getElementById("bgm-time");
  _playlistBtn = document.getElementById("bgm-list-btn");
  _playlistPanel = document.getElementById("bgm-playlist-panel");
  _playlistContainer = document.getElementById("bgm-playlist-container");
  _videoPreview = document.getElementById("bgm-video-preview");

  // Create the YT container INSIDE the preview before initializing
  if (_videoPreview) {
    const ytTarget = document.createElement("div");
    ytTarget.id = "yt-bgm-player";
    ytTarget.style.cssText = "width:100%; height:100%; pointer-events:none;";
    _videoPreview.appendChild(ytTarget);
  }

  // Initial playlist render
  _renderPlaylist();
};

// ─── Event Binding ────────────────────────────────────────────

const _bindEvents = () => {
  _playBtn?.addEventListener("click", togglePlay);

  document.getElementById("bgm-prev")?.addEventListener("click", prev);
  document.getElementById("bgm-next")?.addEventListener("click", next);
  document.getElementById("bgm-shuffle")?.addEventListener("click", toggleShuffle);
  document.getElementById("bgm-repeat")?.addEventListener("click", toggleRepeat);

  _volBtn?.addEventListener("click", toggleMute);

  _volumeSlider?.addEventListener("input", (e) => {
    const val = parseInt(/** @type {HTMLInputElement} */(e.target).value, 10);
    setVolume(val);
  });

  _progressBar?.addEventListener("click", (e) => {
    if (!bgmState.duration) return;
    const rect = _progressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * bgmState.duration);
  });

  // Playlist toggle
  _playlistBtn?.addEventListener("click", () => {
    _playlistPanel?.classList.toggle("active");
  });
  document.getElementById("bgm-close-list")?.addEventListener("click", () => {
    _playlistPanel?.classList.remove("active");
  });

  // Hover for video
  _bar?.addEventListener("mouseenter", () => {
    _videoPreview?.classList.add("visible");
  });
  _bar?.addEventListener("mouseleave", () => {
    _videoPreview?.classList.remove("visible");
  });
};

// ─── UI Update ────────────────────────────────────────────────
let _lastIdx = -1;

const _updateUI = (state = null) => {
  if (!_bar) return;

  // Play/Pause icon
  if (_playBtn) {
    _playBtn.innerHTML = bgmState.playing ? ICON_PAUSE : ICON_PLAY;
    _playBtn.title = bgmState.playing ? "일시정지" : "재생";
  }

  // Shuffle & Repeat
  const shuffleBtn = document.getElementById("bgm-shuffle");
  const repeatBtn = document.getElementById("bgm-repeat");

  if (shuffleBtn) {
    shuffleBtn.classList.toggle("active", bgmState.shuffle);
  }
  if (repeatBtn) {
    if (bgmState.repeatMode === 'one') {
      repeatBtn.innerHTML = ICON_REPEAT_ONE;
      repeatBtn.classList.add("active");
    } else if (bgmState.repeatMode === 'all') {
      repeatBtn.innerHTML = ICON_REPEAT;
      repeatBtn.classList.add("active");
    } else {
      repeatBtn.innerHTML = ICON_REPEAT;
      repeatBtn.classList.remove("active");
    }
  }

  // Track title
  const track = getCurrentTrack();
  if (_titleEl && track) {
    _titleEl.textContent = track.title;
  }

  // Progress
  if (_progressFill && bgmState.duration > 0) {
    const pct = (bgmState.currentTime / bgmState.duration) * 100;
    _progressFill.style.width = `${pct}%`;
  }

  // Time
  if (_timeEl) {
    _timeEl.textContent = _formatTime(bgmState.currentTime) + " / " + _formatTime(bgmState.duration);
  }

  // Volume icon
  if (_volBtn) {
    _volBtn.innerHTML = bgmState.muted ? ICON_MUTE : ICON_VOL;
    _volBtn.classList.toggle("muted", bgmState.muted);
  }

  // Volume slider
  if (_volumeSlider && !bgmState.muted) {
    _volumeSlider.value = String(bgmState.volume);
  }

  const volPercentEl = document.getElementById("bgm-vol-percent");
  if (volPercentEl) {
    volPercentEl.textContent = `${bgmState.muted ? 0 : bgmState.volume}%`;
  }

  // Visualizer animation
  const visualizer = _bar.querySelector(".audio-bar-visualizer");
  if (visualizer) {
    visualizer.classList.toggle("active", bgmState.playing);
  }

  // Render Playlist ONLY if track changed
  if (_lastIdx !== bgmState.currentIndex) {
    _lastIdx = bgmState.currentIndex;
    _renderPlaylist();
  }
};

const _renderPlaylist = () => {
  if (!_playlistContainer) return;

  const list = getPlaylist();
  const html = list.map((item, idx) => {
    const isActive = bgmState.currentIndex === idx;
    return `
            <div class="bgm-list-item ${isActive ? 'active' : ''}" data-index="${idx}">
                <div class="bgm-list-thumb">
                    <img src="https://img.youtube.com/vi/${item.id}/default.jpg" alt="thumb">
                </div>
                <div class="bgm-list-info">
                    <div class="bgm-list-title">${item.title}</div>
                </div>
                ${isActive ? '<div class="bgm-active-indicator"><span></span><span></span><span></span></div>' : ''}
            </div>
        `;
  }).join("");

  _playlistContainer.innerHTML = html;

  // Item click
  _playlistContainer.querySelectorAll(".bgm-list-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.index, 10);
      setTrack(idx);
    });
  });
};

/**
 * @param {number} sec
 * @returns {string}
 */
const _formatTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
