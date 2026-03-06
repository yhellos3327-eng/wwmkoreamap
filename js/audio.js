// @ts-check
import { MAP_CONFIGS } from "./config.js";

/** @type {any} */
let player = null;
let isApiLoaded = false;
let isMuted = false;
let currentBgmId = null;
let isPlayerReady = false;
let currentVolume = 15;

/**
 * YouTube API를 로드하고 플레이어를 초기화합니다.
 */
export const initAudioManager = () => {
    if (isApiLoaded) return;

    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
        isApiLoaded = true;
        createPlayer();
        initAudioUI();
    };

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        document.head.appendChild(tag);
    }
};

const createPlayer = () => {
    let container = document.getElementById('youtube-bgm-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'youtube-bgm-container';
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.pointerEvents = 'none';
        container.style.opacity = '0';
        document.body.appendChild(container);
    }

    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-bgm-active-player';
    container.appendChild(playerDiv);

    // @ts-ignore
    player = new window.YT.Player('youtube-bgm-active-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'origin': window.location.origin
        },
        events: {
            'onReady': (/** @type {any} */ event) => {
                isPlayerReady = true;
                if (player.setVolume) {
                    player.setVolume(currentVolume);
                }
                if (currentBgmId) {
                    playBgmById(currentBgmId);
                }
            },
            'onStateChange': (/** @type {any} */ event) => {
                // @ts-ignore
                if (event.data === window.YT.PlayerState.ENDED) {
                    player.playVideo(); // Loop
                }
                updateAudioUI();
            }
        }
    });
};

/**
 * 맵 키에 해당하는 BGM을 재생합니다.
 * @param {string} mapKey 
 */
export const playBgm = (mapKey) => {
    const config = MAP_CONFIGS[mapKey];
    if (!config || !config.bgmId) {
        stopBgm();
        return;
    }

    // 동일한 BGM인 경우 노래를 초기화하지 않음 (연속 재생)
    if (currentBgmId === config.bgmId && isPlayerReady && player) {
        // @ts-ignore
        const state = player.getPlayerState();
        // @ts-ignore
        if (state !== window.YT.PlayerState.PLAYING) {
            player.playVideo();
        }
        updateAudioUI();
        return;
    }

    currentBgmId = config.bgmId;
    if (isPlayerReady && player) {
        playBgmById(currentBgmId);
    }
};

/**
 * 비디오 ID로 BGM을 재생합니다.
 * @param {string} id 
 */
const playBgmById = (id) => {
    if (!player) return;

    player.loadVideoById({
        videoId: id,
        suggestedQuality: 'small'
    });

    player.unMute();
    if (player.setVolume) {
        player.setVolume(currentVolume);
    }
    player.playVideo();
    updateAudioUI();
};

/**
 * BGM을 중지합니다.
 */
export const stopBgm = () => {
    if (player && player.stopVideo) {
        player.stopVideo();
    }
    updateAudioUI();
};

/**
 * 음소거 상태를 토글합니다.
 * @returns {boolean} 새로운 음소거 상태
 */
export const toggleMute = () => {
    if (!player) return isMuted;

    isMuted = !isMuted;
    if (isMuted) {
        player.mute();
    } else {
        player.unMute();
        player.playVideo();
    }
    updateAudioUI();
    return isMuted;
};

/**
 * UI 버튼 이벤트 초기화
 */
const initAudioUI = () => {
    const playBtn = document.getElementById('bgm-play-toggle');
    const muteBtn = document.getElementById('bgm-mute-toggle');
    const volumeSlider = (/** @type {HTMLInputElement | null} */ (document.getElementById('bgm-volume-slider')));

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (player) {
                // @ts-ignore
                const state = player.getPlayerState();
                // @ts-ignore
                if (state === window.YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
                updateAudioUI();
            }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            toggleMute();
        });
    }

    if (volumeSlider) {
        volumeSlider.value = currentVolume.toString();
        volumeSlider.addEventListener('input', (e) => {
            const val = parseInt((/** @type {HTMLInputElement} */ (e.target)).value);
            currentVolume = val;
            if (player && player.setVolume) {
                player.setVolume(val);
                if (val > 0 && isMuted) {
                    toggleMute();
                } else if (val === 0 && !isMuted) {
                    toggleMute();
                }
            }
            updateAudioUI(); // Label update
        });
    }
};

const updateAudioUI = () => {
    if (!player) return;

    const playBtn = document.getElementById('bgm-play-toggle');
    const muteBtn = document.getElementById('bgm-mute-toggle');
    const titleEl = document.getElementById('bgm-track-title');
    const volumeSlider = (/** @type {HTMLInputElement | null} */ (document.getElementById('bgm-volume-slider')));
    const volumeLabel = document.getElementById('bgm-volume-label');

    if (playBtn) {
        // @ts-ignore
        const state = player.getPlayerState();
        // @ts-ignore
        const isPlaying = state === window.YT.PlayerState.PLAYING;

        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');

        if (playIcon) /** @type {HTMLElement} */ (playIcon).style.display = isPlaying ? 'none' : 'block';
        if (pauseIcon) /** @type {HTMLElement} */ (pauseIcon).style.display = isPlaying ? 'block' : 'none';

        playBtn.classList.toggle('active', isPlaying);
    }

    if (muteBtn) {
        const _isMuted = player.isMuted();
        const unmuteIcon = muteBtn.querySelector('.unmute-icon');
        const muteIcon = muteBtn.querySelector('.mute-icon');

        if (unmuteIcon) /** @type {HTMLElement} */ (unmuteIcon).style.display = _isMuted ? 'none' : 'block';
        if (muteIcon) /** @type {HTMLElement} */ (muteIcon).style.display = _isMuted ? 'block' : 'none';

        muteBtn.classList.toggle('muted', _isMuted);

        if (volumeSlider) {
            if (_isMuted) {
                volumeSlider.value = '0';
            } else {
                volumeSlider.value = currentVolume.toString();
            }
        }

        if (volumeLabel) {
            if (_isMuted) {
                volumeLabel.textContent = '0%';
            } else {
                volumeLabel.textContent = `${currentVolume}%`;
            }
        }
    }

    if (titleEl && player.getVideoData) {
        const videoData = player.getVideoData();
        if (videoData && videoData.title) {
            titleEl.textContent = videoData.title;
        }
    }
};

/**
 * 음소거 상태를 반환합니다.
 * @returns {boolean}
 */
export const isBgmMuted = () => isMuted;
