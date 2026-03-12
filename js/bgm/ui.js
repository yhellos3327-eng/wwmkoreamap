// @ts-check

/**
 * @fileoverview BGM Player UI — 사이드바 하단 오디오 바
 */

import {
  initYTPlayer, isReady, togglePlay, next, prev,
  setVolume, toggleMute, seekTo, onStateChange,
  bgmState, getCurrentTrack, getPlaylist,
} from "./player.js";

// ─── SVG Icons ────────────────────────────────────────────────
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
const ICON_PREV = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="2" height="16"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="2" height="16"/></svg>`;
const ICON_VOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>`;
const ICON_MUTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

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

// ─── Public ───────────────────────────────────────────────────

/**
 * BGM 플레이어 초기화 — DOM 생성 + YT API 로드
 */
export const initBgmPlayer = () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || document.getElementById("audio-bar")) return;

  _createDOM(sidebar);
  _bindEvents();

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
    <div class="audio-bar-progress" id="bgm-progress-bar">
      <div class="audio-bar-progress-fill" id="bgm-progress-fill"></div>
    </div>
    <div class="audio-bar-content">
      <div class="audio-bar-info">
        <span class="audio-bar-title" id="bgm-title">BGM Player</span>
        <span class="audio-bar-time" id="bgm-time">0:00</span>
      </div>
      <div class="audio-bar-controls">
        <button class="audio-btn" id="bgm-prev" title="이전">${ICON_PREV}</button>
        <button class="audio-btn audio-btn-play" id="bgm-play" title="재생" disabled>${ICON_PLAY}</button>
        <button class="audio-btn" id="bgm-next" title="다음">${ICON_NEXT}</button>
        <button class="audio-btn audio-btn-vol" id="bgm-vol-btn" title="음량">${ICON_VOL}</button>
        <input type="range" class="audio-volume-slider" id="bgm-volume" min="0" max="100" value="${bgmState.volume}">
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
};

// ─── Event Binding ────────────────────────────────────────────

const _bindEvents = () => {
  _playBtn?.addEventListener("click", togglePlay);

  document.getElementById("bgm-prev")?.addEventListener("click", prev);
  document.getElementById("bgm-next")?.addEventListener("click", next);

  _volBtn?.addEventListener("click", toggleMute);

  _volumeSlider?.addEventListener("input", (e) => {
    const val = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
    setVolume(val);
  });

  _progressBar?.addEventListener("click", (e) => {
    if (!bgmState.duration) return;
    const rect = _progressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * bgmState.duration);
  });
};

// ─── UI Update ────────────────────────────────────────────────

const _updateUI = () => {
  if (!_bar) return;

  // Play/Pause icon
  if (_playBtn) {
    _playBtn.innerHTML = bgmState.playing ? ICON_PAUSE : ICON_PLAY;
    _playBtn.title = bgmState.playing ? "일시정지" : "재생";
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
    _timeEl.textContent = _formatTime(bgmState.currentTime);
  }

  // Volume icon
  if (_volBtn) {
    _volBtn.innerHTML = bgmState.muted ? ICON_MUTE : ICON_VOL;
  }

  // Volume slider
  if (_volumeSlider && !bgmState.muted) {
    _volumeSlider.value = String(bgmState.volume);
  }
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
