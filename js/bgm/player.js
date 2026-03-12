// @ts-check

/**
 * @fileoverview YouTube IFrame API 기반 BGM 플레이어
 * - hidden iframe으로 오디오만 재생
 * - 플레이리스트 순환, 셔플, 에러 시 자동 스킵
 */

// ─── Playlist ──────────────────────────────────────────────────
const PLAYLIST = [
  { id: "T6si35-eMPE", title: "獻給所有離鄉遊子的思鄉曲 (A Song for Those Far from Home)" },
  { id: "-OA8YIEo7is", title: "桂枝香" },
  { id: "Fkc_imtLZ3k", title: "凉州歌 (양저우 곡)" },
  { id: "cGNEc4_g8Po", title: "凉州箫鼓 (양저우 퉁소와 북)" },
  { id: "U8HUkUvH_2s", title: "옥문관 백두성 곽흔 OST (邊塞詩)" }
];

// ─── State ────────────────────────────────────────────────────
/** @type {YT.Player|null} */
let _player = null;
let _ready = false;
let _progressInterval = null;

export const bgmState = {
  playing: false,
  currentIndex: 0,
  volume: 5,
  duration: 0,
  currentTime: 0,
  muted: false,
};

/** @type {Set<Function>} */
const _listeners = new Set();

// ─── Public API ───────────────────────────────────────────────

/**
 * YouTube IFrame API 로드 + Player 초기화
 * @returns {Promise<void>}
 */
export const initYTPlayer = () => {
  return new Promise((resolve) => {
    if (_ready) { resolve(); return; }

    // Use provided container or create a default one
    let target = document.getElementById("yt-bgm-player");
    if (!target) {
      target = document.createElement("div");
      target.id = "yt-bgm-player";
      target.style.cssText = "position:absolute; width:0; height:0; pointer-events:none; opacity:0; z-index: -1;";
      document.body.appendChild(target);
    }

    // API script
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
      _player = new YT.Player("yt-bgm-player", {
        height: "100%",
        width: "100%",
        videoId: PLAYLIST[0].id,
        playerVars: {
          autoplay: 0,
          controls: 0, // Hiding video UI controls
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: () => {
            _ready = true;
            _player.setVolume(bgmState.volume);
            resolve();
          },
          onStateChange: _handleStateChange,
          onError: _handleError,
        },
      });
    };
  });
};

export const isReady = () => _ready;

export const getPlaylist = () => PLAYLIST;

export const getCurrentTrack = () => PLAYLIST[bgmState.currentIndex] || null;

export const togglePlay = () => {
  if (!_ready || !_player) return;
  if (bgmState.playing) {
    _player.pauseVideo();
  } else {
    _player.playVideo();
  }
};

export const play = () => {
  if (_ready && _player) _player.playVideo();
};

export const pause = () => {
  if (_ready && _player) _player.pauseVideo();
};

export const next = () => {
  if (!_ready || !_player) return;
  bgmState.currentIndex = (bgmState.currentIndex + 1) % PLAYLIST.length;
  _loadAndPlay(bgmState.currentIndex);
};

export const prev = () => {
  if (!_ready || !_player) return;
  // 3초 이상 재생했으면 처음부터, 아니면 이전 트랙
  if (bgmState.currentTime > 3) {
    _player.seekTo(0, true);
  } else {
    bgmState.currentIndex = (bgmState.currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    _loadAndPlay(bgmState.currentIndex);
  }
};

/**
 * @param {number} vol 0-100
 */
export const setVolume = (vol) => {
  bgmState.volume = Math.max(0, Math.min(100, vol));
  bgmState.muted = bgmState.volume === 0;
  if (_ready && _player) _player.setVolume(bgmState.volume);
  _notify();
};

export const toggleMute = () => {
  if (!_ready || !_player) return;
  if (bgmState.muted) {
    _player.unMute();
    _player.setVolume(bgmState.volume || 50);
    bgmState.muted = false;
  } else {
    _player.mute();
    bgmState.muted = true;
  }
  _notify();
};

/**
 * @param {number} seconds
 */
export const seekTo = (seconds) => {
  if (_ready && _player) _player.seekTo(seconds, true);
};

/**
 * @param {Function} cb
 */
export const onStateChange = (cb) => { _listeners.add(cb); };

/**
 * @param {Function} cb
 */
export const offStateChange = (cb) => { _listeners.delete(cb); };

/**
 * @param {number} index
 */
export const setTrack = (index) => {
  if (!_ready || !_player) return;
  if (index < 0 || index >= PLAYLIST.length) return;
  bgmState.currentIndex = index;
  _loadAndPlay(index);
};

// ─── Private ──────────────────────────────────────────────────

/** @param {number} index */
const _loadAndPlay = (index) => {
  const track = PLAYLIST[index];
  if (!track || !_player) return;
  _player.loadVideoById(track.id);
  _notify();
};

const _handleStateChange = (event) => {
  const st = event.data;
  // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
  bgmState.playing = st === 1;

  if (st === 1) {
    bgmState.duration = _player?.getDuration?.() || 0;
    _startProgressTracking();
  } else {
    _stopProgressTracking();
  }

  if (st === 0) {
    // 트랙 끝 → 다음
    next();
  }

  _notify();
};

const _handleError = () => {
  console.warn("[BGM] YouTube error, skipping to next track");
  next();
};

const _startProgressTracking = () => {
  _stopProgressTracking();
  _progressInterval = setInterval(() => {
    if (_player && bgmState.playing) {
      bgmState.currentTime = _player.getCurrentTime?.() || 0;
      bgmState.duration = _player.getDuration?.() || 0;
      _notify();
    }
  }, 500);
};

const _stopProgressTracking = () => {
  if (_progressInterval) {
    clearInterval(_progressInterval);
    _progressInterval = null;
  }
};

const _notify = () => {
  for (const cb of _listeners) {
    try { cb(bgmState); } catch (e) { console.error("[BGM] listener error:", e); }
  }
};
