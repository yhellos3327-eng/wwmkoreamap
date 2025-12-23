import { state } from '../state.js';
import { t, getJosa } from '../utils.js';

export const createPopupHtml = (item, lat, lng, regionName) => {
    const isFav = state.favorites.includes(item.id);
    const isCompleted = state.completedList.includes(item.id);
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
                return `<img src="${media.src}" class="popup-media ${activeClass}" onclick="window.openLightbox(${item.id}, ${media.index})" alt="${translatedName}">`;
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
                    <div class="popup-media popup-video-wrapper ${activeClass}" onclick="window.openVideoLightbox('${lightboxSrc}')">
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
            <button class="img-nav-btn prev" onclick="event.stopPropagation(); window.switchImage(this, -1)" style="display:block">❮</button>
            <button class="img-nav-btn next" onclick="event.stopPropagation(); window.switchImage(this, 1)" style="display:block">❯</button>
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
            <button class="btn-translate" onclick="window.translateItem(${item.id})" style="width:100%; margin-top:10px; padding:6px; background:var(--accent-bg); border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">
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
                    <button class="btn-search-modal" onclick="window.openRelatedModal('${item.category}')" title="전체 목록 검색">🔍</button>
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

                <form class="comment-form" onsubmit="window.submitAnonymousComment(event, ${item.id})">
                    <div class="comment-input-group">
                        <input type="text" class="comment-nickname" placeholder="닉네임" maxlength="8">
                        <button type="button" class="btn-guide" onclick="document.getElementById('comment-guide-${item.id}').classList.toggle('hidden')" title="작성 가이드">?</button>
                    </div>
                    <div class="comment-input-wrapper" style="position: relative;">
                        <div id="sticker-modal-${item.id}" class="sticker-modal">
                            <div class="sticker-grid" id="sticker-grid-${item.id}">
                                <!-- Stickers will be loaded here -->
                            </div>
                        </div>
                        <button type="button" class="btn-sticker" onclick="window.toggleStickerModal(${item.id})" title="스티커">😊</button>
                        <input type="text" class="comment-input" placeholder="정보 공유하기..." required>
                        <button type="submit" class="comment-submit">등록</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    }

    const contentId = `popup-content-${item.id}`;

    if (isExternalContent) {
        setTimeout(() => {
            const container = document.getElementById(contentId);
            if (container) {
            }
        }, 100);
    }

    const bodyContent = isExternalContent
        ? `<div id="${contentId}"></div>`
        : (itemDescription.startsWith('<p') ? itemDescription : `<p>${itemDescription}</p>`);

    return `
    <div class="popup-container" data-id="${item.id}">
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
            <button class="action-btn btn-fav ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); window.toggleFavorite(${item.id})" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" onclick="event.stopPropagation(); window.toggleCompleted(${item.id})" title="완료 상태로 표시">${isCompleted ? '완료됨' : '완료 체크'}</button>
            <button class="action-btn btn-share" onclick="event.stopPropagation(); window.shareLocation(${item.id}, ${lat}, ${lng})" title="위치 공유">📤</button>
        </div>
        <div class="popup-footer">
            <div class="footer-badges">
                <span class="badge">${categoryName}</span>
                <span class="badge">${t(displayRegion)}</span>
            </div>
            <button class="btn-report-styled" onclick="window.openReportPage(${item.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                오류 제보
            </button>
        </div>
    </div>
`;
};
