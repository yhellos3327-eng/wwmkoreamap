import { state } from '../state.js';
import { t, getJosa } from '../utils.js';
import { formatCompletedTime } from '../ui/navigation.js';
import {
    openLightbox,
    openVideoLightbox,
    switchImage,
    translateItem,
    openRelatedModal,
    toggleFavorite,
    toggleCompleted,
    shareLocation,
    openReportPage
} from '../ui.js';
import { toggleStickerModal, submitAnonymousComment } from '../comments.js';

export const createPopupHtml = (item, lat, lng, regionName) => {
    const isFav = state.favorites.includes(item.id);
    const completedItem = state.completedList.find(c => c.id === item.id);
    const isCompleted = !!completedItem;
    const completedTimeStr = completedItem && completedItem.completedAt
        ? formatCompletedTime(completedItem.completedAt)
        : '';
    const displayRegion = item.forceRegion || regionName;
    let translatedName = t(item.name);
    if (translatedName) {
        translatedName = translatedName.replace(/{region}/g, displayRegion);
    }
    const categoryName = t(item.category);

    let itemDescription = (item.description || '').trim()
    let replaceName = translatedName;
    const josa = typeof getJosa === 'function' ? getJosa(translatedName, '으로/로') : '로';
    replaceName = translatedName + josa;

    let isExternalContent = false;
    if (itemDescription && (itemDescription.startsWith('http://') || itemDescription.startsWith('https://') || itemDescription.startsWith('json:'))) {
        isExternalContent = true;
    }

    if (!isExternalContent) {
        if (itemDescription) {
            itemDescription = itemDescription.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>');
            itemDescription = itemDescription.replace(/\n/g, '<br>');
            itemDescription = itemDescription.replace(/{name}/g, replaceName);
            itemDescription = itemDescription.replace(/{region}/g, displayRegion);
        } else {
            itemDescription = '';
        }
    }

    let mediaHtml = '';
    const mediaItems = [];

    if (item.images && item.images.length > 0) {
        item.images.forEach((src, idx) => {
            mediaItems.push({
                type: 'image',
                src: src,
                index: idx
            });
        });
    }

    if (item.video_url) {
        if (Array.isArray(item.video_url)) {
            item.video_url.forEach(url => {
                if (url && typeof url === 'string' && url.trim() !== "") {
                    mediaItems.push({
                        type: 'video',
                        src: url.trim()
                    });
                }
            });
        } else if (typeof item.video_url === 'string' && item.video_url.trim() !== "") {
            mediaItems.push({
                type: 'video',
                src: item.video_url.trim()
            });
        }
    }

    if (mediaItems.length > 0) {
        const slides = mediaItems.map((media, index) => {
            const activeClass = index === 0 ? 'active' : '';

            if (media.type === 'image') {
                return `<img src="${media.src}" class="popup-media ${activeClass}" data-action="lightbox" data-item-id="${item.id}" data-index="${media.index}" alt="${translatedName}">`;
            } else {
                let videoSrc = media.src.replace(/^http:/, 'https:');
                if (videoSrc.startsWith('//')) videoSrc = 'https:' + videoSrc;

                let thumbSrc = videoSrc;
                let lightboxSrc = videoSrc;

                const ytMatch = videoSrc.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                if (ytMatch && ytMatch[1]) {
                    const ytId = ytMatch[1];
                    thumbSrc = `https://www.youtube.com/embed/${ytId}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0`;
                    lightboxSrc = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
                }

                if (videoSrc.includes('bilibili.com')) {
                    const separator = videoSrc.includes('?') ? '&' : '?';
                    lightboxSrc = videoSrc.replace(/&?autoplay=\d/, '');
                    lightboxSrc += `${separator}autoplay=1&high_quality=1`;

                    thumbSrc = videoSrc.replace(/&?autoplay=\d/, '');
                    thumbSrc += `${separator}autoplay=0&t=0&danmaku=0&high_quality=1&muted=1`;
                }

                return `
                    <div class="popup-media popup-video-wrapper ${activeClass}" data-action="video-lightbox" data-src="${lightboxSrc}">
                        <iframe 
                            src="${thumbSrc}" 
                            style="width:100%; height:100%; pointer-events:none;" 
                            frameborder="0" 
                            scrolling="no"
                            allowfullscreen>
                        </iframe>
                        <div class="video-thumb-cover">
                            <div class="video-play-icon"></div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        const navBtns = mediaItems.length > 1 ? `
            <button class="img-nav-btn prev" data-action="switch-image" data-dir="-1" style="display:block">❮</button>
            <button class="img-nav-btn next" data-action="switch-image" data-dir="1" style="display:block">❯</button>
            <span class="img-counter">1 / ${mediaItems.length}</span>
        ` : '';

        mediaHtml = `
            <div class="popup-image-container" data-idx="0" data-total="${mediaItems.length}">
                ${slides}
                ${navBtns}
            </div>
        `;
    }

    let translateBtnHtml = '';
    if (!item.isTranslated && item.description && item.description.trim() !== "" && !isExternalContent) {
        translateBtnHtml = `
            <button class="btn-translate" data-action="translate" data-item-id="${item.id}" style="width:100%; margin-top:10px; padding:6px; background:var(--accent-bg); border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">
                ✨ AI 번역 (Chinese -> Korean)
            </button>
        `;
    }

    let relatedHtml = '';
    if (state.showComments) {
        relatedHtml = `
        <div class="popup-related">
            <div class="popup-related-header">
                <h5>
                    <span style="flex:1">이정표</span>
                    <button class="btn-search-modal" data-action="open-modal" data-category="${item.category}" title="전체 목록 검색">🔍</button>
                </h5>
            </div>
            <div class="popup-comments-container">
                <div id="comments-list-${item.id}" class="comments-list">
                    <div class="loading-comments">이정표 불러오는 중...</div>
                </div>
                
                <div id="comment-guide-${item.id}" class="comment-guide hidden">
                    <h6>📝 작성 가이드</h6>
                    <ul>
                        <li><b>**굵게**</b>, <i>*기울임*</i>, <u>__밑줄__</u>, <del>~~취소선~~</del></li>
                        <li>[color:#ffaa00]색상[/c]</li>
                        <li>URL 입력 시 자동 링크</li>
                    </ul>
                </div>

                <form class="comment-form" data-item-id="${item.id}">
                    <div class="comment-input-group">
                        <input type="text" class="comment-nickname" placeholder="닉네임" maxlength="8">
                        <input type="password" class="comment-password" placeholder="비밀번호" maxlength="16" title="삭제 시 필요">
                        <button type="button" class="btn-guide" data-action="toggle-guide" data-target="comment-guide-${item.id}" title="작성 가이드">?</button>
                    </div>
                    <div class="comment-input-wrapper" style="position: relative;">
                        <div id="sticker-modal-${item.id}" class="sticker-modal">
                            <div class="sticker-grid" id="sticker-grid-${item.id}">
                                <!-- Stickers will be loaded here -->
                            </div>
                        </div>
                        <button type="button" class="btn-sticker" data-action="toggle-sticker" data-item-id="${item.id}" title="스티커">😊</button>
                        <input type="text" class="comment-input" placeholder="정보 공유하기..." required>
                        <button type="submit" class="comment-submit">등록</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    }

    const contentId = `popup-content-${item.id}`;



    const bodyContent = isExternalContent
        ? `<div id="${contentId}"></div>`
        : (itemDescription.startsWith('<p') ? itemDescription : `<p>${itemDescription}</p>`);

    return `
    <div class="popup-container" data-id="${item.id}" data-lat="${lat}" data-lng="${lng}">
        <div class="popup-header">
            <div style="display: flex; align-items: center;">
                <img src="./icons/${item.category}.png" class="popup-icon" alt="${categoryName}" onerror="this.style.display='none'">
                <h4>${translatedName}</h4>
            </div>
        </div>
        <div class="popup-body">
            ${mediaHtml}
            ${bodyContent}
            ${translateBtnHtml}
        </div>
        ${relatedHtml}
        <div class="popup-actions">
            <button class="action-btn btn-fav ${isFav ? 'active' : ''}" data-action="toggle-fav" data-item-id="${item.id}" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" data-action="toggle-complete" data-item-id="${item.id}" title="완료 상태로 표시">${isCompleted ? `완료됨${completedTimeStr ? `<span class="completed-time">${completedTimeStr}</span>` : ''}` : '완료 체크'}</button>
            <button class="action-btn btn-route" data-action="add-to-route" data-item-id="${item.id}" title="경로에 추가">경로 추가</button>
            <button class="action-btn btn-share" data-action="share" data-item-id="${item.id}" title="위치 공유">📤</button>
        </div>
        <div class="popup-footer">
            <div class="footer-badges">
                <span class="badge">${categoryName}</span>
                <span class="badge">${t(displayRegion)}</span>
            </div>
            <button class="btn-report-styled" data-action="report" data-item-id="${item.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                오류 제보
            </button>
        </div>
    </div>
`;
};

// 이벤트 위임으로 팝업 내 이벤트 처리
export const initPopupEventDelegation = () => {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const itemId = target.dataset.itemId;
        const popupContainer = target.closest('.popup-container');

        e.stopPropagation();

        switch (action) {
            case 'lightbox':
                openLightbox(parseInt(itemId), parseInt(target.dataset.index));
                break;
            case 'video-lightbox':
                openVideoLightbox(target.dataset.src);
                break;
            case 'switch-image':
                switchImage(target, parseInt(target.dataset.dir));
                break;
            case 'translate':
                translateItem(parseInt(itemId));
                break;
            case 'open-modal':
                openRelatedModal(target.dataset.category);
                break;
            case 'toggle-guide':
                document.getElementById(target.dataset.target)?.classList.toggle('hidden');
                break;
            case 'toggle-sticker':
                toggleStickerModal(parseInt(itemId));
                break;
            case 'toggle-fav':
                toggleFavorite(parseInt(itemId));
                break;
            case 'toggle-complete':
                toggleCompleted(parseInt(itemId));
                break;
            case 'share':
                if (popupContainer) {
                    const lat = popupContainer.dataset.lat;
                    const lng = popupContainer.dataset.lng;
                    shareLocation(parseInt(itemId), parseFloat(lat), parseFloat(lng));
                }
                break;
            case 'report':
                openReportPage(parseInt(itemId));
                break;
            case 'add-to-route':
                import('../route/index.js').then(routeModule => {
                    if (routeModule.isManualRouteMode()) {
                        const added = routeModule.addToManualRoute(itemId);
                        if (added) {
                            target.textContent = '✓';
                            target.style.background = 'var(--success)';
                            target.style.color = 'white';
                        }
                    } else {
                        alert('수동 경로 구성 모드가 아닙니다. 경로 모드에서 "직접 구성"을 선택해주세요.');
                    }
                }).catch(() => {
                    alert('경로 모듈을 불러올 수 없습니다.');
                });
                break;
        }
    });

    document.addEventListener('submit', (e) => {
        const form = e.target.closest('.comment-form');
        if (form) {
            e.preventDefault();
            const itemId = form.dataset.itemId;
            if (itemId && submitAnonymousComment) {
                submitAnonymousComment(e, parseInt(itemId));
            }
        }
    });
};
