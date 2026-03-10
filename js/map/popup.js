// @ts-check
import { state } from "../state.js";
import { t, getJosa, parseMarkdown, resetGif } from "../utils.js";
import { formatCompletedTime } from "../ui/navigation.js";
import {
  openLightbox,
  openVideoLightbox,
  switchImage,
  translateItem,
  openRelatedModal,
  toggleCompleted,
  shareLocation,
  toggleFavorite,
} from "../ui.js";
import { isLoggedIn, isAdminUser } from "../auth.js";
import { BACKEND_URL } from "../config.js";
import { toggleStickerModal, submitAnonymousComment } from "../comments.js";
import { renderVoteButtons, toggleVote, fetchVoteCounts } from "../votes.js";
import { lazyLoader } from "../ui/lazy-loader.js";

/**
 * @typedef {import("../data/processors.js").MapItem} MapItem
 */

/**
 * 마커 팝업을 위한 HTML 콘텐츠를 생성합니다.
 * @param {MapItem} item - 지도 아이템.
 * @param {number} lat - 위도.
 * @param {number} lng - 경도.
 * @param {string} regionName - 지역 이름.
 * @returns {string} HTML 문자열.
 */
export const createPopupHtml = (item, lat, lng, regionName, activeReportId = null) => {
  let displayItem = item;

  // Use activeReportId to find which report to show in the main area
  if (activeReportId && String(item.id) !== String(activeReportId)) {
    if (item.aggregated) {
      const found = item.aggregated.find(
        (a) => String(a.id) === String(activeReportId),
      );
      if (found) displayItem = found;
    }
  }

  const isFav =
    state.favorites.includes(String(item.id)) ||
    state.favorites.includes(item.id);
  // @ts-ignore
  const completedId = item.masterId || item.id; // Completion status follows master
  const completedItem = state.completedList.find(
    (c) => String(c.id) === String(completedId),
  );
  const isCompleted = !!completedItem;
  const completedTimeStr =
    completedItem && completedItem.completedAt
      ? formatCompletedTime(completedItem.completedAt)
      : "";
  const displayRegion = displayItem.forceRegion || regionName;
  let translatedName = t(displayItem.name);
  if (translatedName) {
    translatedName = String(translatedName).replace(/{region}/g, displayRegion);
  }
  const categoryName = t(displayItem.category);

  let itemDescription = (displayItem.description || "").trim();
  let replaceName = translatedName;
  const josa =
    typeof getJosa === "function"
      ? getJosa(String(translatedName), "으로/로")
      : "로";
  replaceName = translatedName + josa;

  let isExternalContent = false;
  if (
    itemDescription &&
    (itemDescription.startsWith("http://") ||
      itemDescription.startsWith("https://") ||
      itemDescription.startsWith("json:"))
  ) {
    isExternalContent = true;
  }

  if (!isExternalContent) {
    if (itemDescription) {
      itemDescription = itemDescription.replace(/{name}/g, replaceName);
      itemDescription = itemDescription.replace(/{region}/g, displayRegion);

      itemDescription = parseMarkdown(itemDescription);
    } else {
      itemDescription = "";
    }
  }

  /**
   * @typedef {Object} MediaItem
   * @property {string} type
   * @property {string} src
   * @property {number} [index]
   */
  let mediaHtml = "";
  /** @type {MediaItem[]} */
  const mediaItems = [];

  if (displayItem.images && displayItem.images.length > 0) {
    displayItem.images.forEach((src, idx) => {
      mediaItems.push({
        type: "image",
        src: src,
        index: idx,
      });
    });
  }

  if (item.video_url) {
    if (Array.isArray(item.video_url)) {
      item.video_url.forEach((url) => {
        if (url && typeof url === "string" && url.trim() !== "") {
          mediaItems.push({
            type: "video",
            src: url.trim(),
          });
        }
      });
    } else if (
      typeof item.video_url === "string" &&
      item.video_url.trim() !== ""
    ) {
      mediaItems.push({
        type: "video",
        src: item.video_url.trim(),
      });
    }
  }

  let heroBgStyle = "";
  if (mediaItems.length > 0 && mediaItems[0].type === "image") {
    let imgSrc = mediaItems[0].src;
    if (imgSrc && !imgSrc.startsWith("http") && !imgSrc.startsWith("data:") && !imgSrc.startsWith("/")) {
      if (imgSrc.startsWith("assets.wwmmap.kr")) {
        imgSrc = "https://" + imgSrc;
      }
    }
    heroBgStyle = `background-image: linear-gradient(to bottom, rgba(0,0,0,0.1), var(--wiki-glass-bg) 95%), url('${imgSrc}'); background-size: cover; background-position: center;`;
  }

  if (mediaItems.length > 0) {
    const slides = mediaItems
      .map((media, index) => {
        const activeClass = index === 0 ? "active" : "";

        if (media.type === "image") {
          let imgSrc = media.src;
          if (imgSrc && !imgSrc.startsWith("http") && !imgSrc.startsWith("data:") && !imgSrc.startsWith("/")) {
            if (imgSrc.startsWith("assets.wwmmap.kr")) {
              imgSrc = "https://" + imgSrc;
            }
          }

          const placeholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          const isFirst = index === 0;
          const srcAttr = isFirst ? imgSrc : placeholder;
          const lazyClass = isFirst ? "" : "lazy-load";
          const loadingAttr = isFirst ? "eager" : "lazy";
          const priorityAttr = isFirst ? 'fetchpriority="high"' : "";
          const dataSrcAttr = isFirst ? "" : `data-src="${imgSrc}"`;

          return `<img ${dataSrcAttr} src="${srcAttr}" class="popup-media ${lazyClass} ${activeClass}" data-action="lightbox" data-item-id="${item.id}" data-index="${media.index}" alt="${translatedName}" loading="${loadingAttr}" ${priorityAttr}>`;
        } else {
          let videoSrc = media.src.replace(/^http:/, "https:");
          if (videoSrc.startsWith("//")) videoSrc = "https:" + videoSrc;

          let thumbSrc = videoSrc;
          let lightboxSrc = videoSrc;

          const ytMatch = videoSrc.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
          );
          if (ytMatch && ytMatch[1]) {
            const ytId = ytMatch[1];
            const timeMatch = videoSrc.match(/[?&](?:t|start)=(\d+)/);
            const startTime = timeMatch ? timeMatch[1] : null;
            const startParam = startTime ? `&start=${startTime}` : "";
            thumbSrc = `https://www.youtube.com/embed/${ytId}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${ytId}${startParam}`;
            lightboxSrc = `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}${startParam}`;
          }

          if (videoSrc.includes("bilibili.com")) {
            const separator = videoSrc.includes("?") ? "&" : "?";
            lightboxSrc = videoSrc.replace(/&?autoplay=\d/, "");
            lightboxSrc += `${separator}autoplay=1&loop=1&high_quality=1`;

            thumbSrc = videoSrc.replace(/&?autoplay=\d/, "");
            thumbSrc += `${separator}autoplay=0&loop=1&t=0&danmaku=0&high_quality=1&muted=1`;
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
                    </div>
                `;
        }
      })
      .join("");

    const navBtns =
      mediaItems.length > 1
        ? `
            <button class="img-nav-btn prev" data-action="switch-image" data-dir="-1" style="display:block">❮</button>
            <button class="img-nav-btn next" data-action="switch-image" data-dir="1" style="display:block">❯</button>
            <span class="img-counter">1 / ${mediaItems.length}</span>
        `
        : "";

    mediaHtml = `
            <div class="popup-image-container" data-idx="0" data-total="${mediaItems.length}">
                ${slides}
                ${navBtns}
            </div>
        `;
  }

  let translateBtnHtml = "";
  if (
    !item.isTranslated &&
    !item.isBackend && // Skip translation for community reports
    item.description &&
    item.description.trim() !== "" &&
    !isExternalContent
  ) {
    translateBtnHtml = `
            <div class="wiki-translate-group">
                <button class="wiki-btn-translate" data-action="translate" data-translate-type="ai" data-item-id="${item.id}" title="AI 번역">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> AI 번역
                </button>
            </div>
        `;
  }

  let commentsHtml = "";
  if (state.showComments) {
    commentsHtml = `
            <div class="popup-comments-container">
                <div id="comments-list-${item.id}" class="comments-list">
                    <div class="skeleton-comment">
                        <div class="skeleton-header">
                            <div class="skeleton skeleton-avatar"></div>
                            <div class="skeleton skeleton-date"></div>
                        </div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text short"></div>
                    </div>
                </div>
                
                <div id="comment-guide-${item.id}" class="comment-guide hidden">
                    <h6>📝 작성 가이드</h6>
                    <ul>
                        <li><b>**굵게**</b>, <i>*기울임*</i>, <u>__밑줄__</u>, <del>~~취소선~~</del></li>
                        <li>[color:#ffaa00]색상[/c]</li>
                        <li>URL 입력 시 자동 링크</li>
                    </ul>
                </div>

                <form class="comment-form wiki-comment-form" data-item-id="${item.id}">
                    <div class="wiki-comment-inputs ${isAdminUser() ? 'is-admin-form' : ''}">
                        ${isAdminUser() ? `
                            <div class="admin-indicator-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2.5 18l2.5-10L9 13l3-9 3 9 4-5 2.5 10z" fill="currentColor"/><rect x="2.5" y="18" width="19" height="3.5" rx="1" fill="currentColor" opacity="0.8"/></svg>
                                관리자
                            </div>
                        ` : `
                            <input type="text" class="comment-nickname" placeholder="닉네임" maxlength="8">
                            <input type="password" class="comment-password" placeholder="비밀번호" maxlength="16" title="삭제 시 필요">
                        `}
                    </div>
                    <div class="comment-input-wrapper">
                        <div id="sticker-modal-${item.id}" class="sticker-modal">
                            <div class="sticker-grid" id="sticker-grid-${item.id}"></div>
                        </div>
                        <button type="button" class="btn-sticker" data-action="toggle-sticker" data-item-id="${item.id}" title="스티커">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                        </button>
                        <input type="text" class="comment-input" placeholder="정보 공유하기..." required>
                        <button type="submit" class="comment-submit">등록</button>
                    </div>
                </form>
            </div>
    `;
  }

  const contentId = `popup-content-${item.id}`;
  const bodyContent = isExternalContent
    ? `<div id="${contentId}"></div>`
    : `<div class="wiki-content-markdown">${itemDescription}</div>`;

  let aggregatedReportsHtml = "";
  if (item.aggregated && item.aggregated.length > 0) {
    const allReports = [item, ...item.aggregated];
    const listItems = allReports
      .map((report) => {
        const isActive = String(report.id) === String(displayItem.id);
        const reportAuthor = report.user_id || "Anonymous";
        const reportTitle = t(report.name) || "제보 내용";

        return `
          <div class="wiki-report-card ${isActive ? "active" : ""}" 
               data-action="switch-report" 
               data-item-id="${item.id}" 
               data-report-id="${report.id}">
              <div class="wiki-report-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div class="wiki-report-info">
                  <div class="wiki-report-title">${reportTitle}</div>
                  <div class="wiki-report-author">${reportAuthor}</div>
              </div>
              ${isActive ? `<svg class="wiki-report-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ""}
          </div>
        `;
      })
      .join("");

    aggregatedReportsHtml = `
      <div class="wiki-aggregated-section">
          <h5 class="wiki-section-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              유저 제보 모음 (${allReports.length})
          </h5>
          <div class="wiki-report-list">
              ${listItems}
          </div>
      </div>
    `;
  }

  const adminHtml = (displayItem.isBackend && isAdminUser()) ? `
      <div class="wiki-admin-actions">
          <div class="wiki-admin-label">Admin Tools</div>
          <div class="wiki-admin-btn-group">
              <button class="wiki-admin-btn btn-delete" data-action="admin-delete" data-item-id="${displayItem.id}">삭제</button>
              ${displayItem.status === 'pending' || displayItem.status === 'rejected' ? `<button class="wiki-admin-btn btn-approve" data-action="admin-approve" data-item-id="${displayItem.id}">승인</button>` : ''}
              ${displayItem.status !== 'rejected' ? `<button class="wiki-admin-btn btn-reject" data-action="admin-reject" data-item-id="${displayItem.id}">거부</button>` : ''}
              <button class="wiki-admin-btn btn-block" data-action="admin-block-user" data-user-id="${displayItem.user_id}">유저 차단</button>
          </div>
      </div>
  ` : '';

  return `
    <div class="wiki-popup-container" data-id="${item.id}" data-lat="${lat}" data-lng="${lng}">
        <header class="wiki-hero" style="${heroBgStyle}">
            <div class="wiki-hero-content">
                <div class="wiki-hero-badges">
                    <span class="wiki-badge category">
                        <img src="./icons/${displayItem.category}.png" alt="${categoryName}" onerror="this.style.display='none'">
                        ${categoryName}
                    </span>
                    <span class="wiki-badge region">${t(displayRegion)}</span>
                    ${displayItem.id !== item.id ? '<span class="wiki-badge duplicate">중복 제보</span>' : ''}
                    ${displayItem.isWikiEdited ? '<span class="wiki-badge edited" title="유저 참여로 수정된 문서입니다.">위키 반영됨</span>' : ''}
                </div>
                <h2 class="wiki-hero-title">${translatedName}</h2>
                ${displayItem.user_id ? `
                    <div class="wiki-hero-author">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${displayItem.user_id}
                    </div>
                ` : ''}
            </div>
        </header>

        <nav class="wiki-tab-nav">
            <label class="wiki-tab-label">
                <input type="radio" name="wiki-tab-${item.id}" value="info" checked>
                <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> 문서</span>
            </label>
            ${state.showComments ? `
            <label class="wiki-tab-label">
                <input type="radio" name="wiki-tab-${item.id}" value="community">
                <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> 커뮤니티</span>
            </label>` : ''}
        </nav>

        <div class="wiki-tab-panels">
            <section class="wiki-tab-panel info-panel">
                ${mediaItems.length > 0 ? `
                <div class="wiki-media-section">
                    <div class="wiki-media-header">
                        <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> 미디어 (${mediaItems.length})</span>
                        <div class="wiki-media-toggle">
                            <button class="active" data-action="toggle-media-view" data-view="slide" data-item-id="${item.id}" title="슬라이드 뷰">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                            </button>
                            <button data-action="toggle-media-view" data-view="inline" data-item-id="${item.id}" title="본문 삽입 뷰">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                    <div class="wiki-media-content slide-view" id="media-content-${item.id}">
                        ${mediaHtml}
                    </div>
                </div>` : ''}

                ${bodyContent}

                <div class="wiki-info-actions">
                    <button class="wiki-action-sm" data-action="open-edit-modal" data-item-id="${displayItem.id}" data-is-official="${!displayItem.isBackend}" title="이 마커 정보 수정 제안하기">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> 편집 제안
                    </button>
                    <button class="wiki-action-sm" data-action="open-history-modal" data-item-id="${displayItem.id}" title="이 마커의 수정 역사 보기">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 역사 기록
                    </button>
                    ${translateBtnHtml}
                </div>
                ${renderVoteButtons(displayItem.id, false, !!displayItem.isBackend)}
                ${aggregatedReportsHtml}
                ${adminHtml}
            </section>

            ${state.showComments ? `
            <section class="wiki-tab-panel community-panel">
                ${commentsHtml}
            </section>` : ''}
        </div>

        <div class="wiki-sticky-action-bar">
            <button class="wiki-fab-btn ${isFav ? "active" : ""}" data-action="toggle-fav" data-item-id="${displayItem.id}" title="즐겨찾기">
                <svg viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="wiki-fab-btn ${isCompleted ? "active" : ""}" data-action="toggle-complete" data-item-id="${completedId}" title="획득 완료">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="wiki-fab-btn route" data-action="add-to-route" data-item-id="${displayItem.id}" title="경로 추가">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"></circle><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path></svg>
            </button>
            <button class="wiki-fab-btn" data-action="share" data-item-id="${item.id}" title="공유하기">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
        </div>
    </div>
  `;
};

/**
 * 팝업 이벤트 위임을 초기화합니다.
 */
export const initPopupEventDelegation = () => {
  if (state.map) {
    state.map.on("popupopen", (e) => {
      const popupNode = e.popup.getElement();
      if (popupNode) {
        lazyLoader.observeAll(".lazy-load", popupNode);

        const voteContainer = popupNode.querySelector(".vote-container");
        if (voteContainer && voteContainer.dataset.isBackend === "true") {
          const itemId = voteContainer.dataset.itemId;
          if (itemId) fetchVoteCounts(itemId, true);
        }

        const questInfoEl = popupNode.querySelector(".popup-quest-info");
        if (questInfoEl && questInfoEl.dataset.itemId) {
          const itemId = questInfoEl.dataset.itemId;
          import("../quest-guide/index.js").then(({ findQuestLineForMarker }) => {
            findQuestLineForMarker(itemId).then((quest) => {
              if (quest) {
                questInfoEl.innerHTML = `
                  <div class="quest-link-banner" data-action="open-quest" data-quest-id="${quest.id}">
                    <div class="banner-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                    </div>
                    <div class="banner-info">
                      <div class="banner-label">관련 퀘스트</div>
                      <div class="banner-title">${quest.title}</div>
                    </div>
                    <svg class="banner-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                `;
                questInfoEl.classList.remove("hidden");
                const banner = questInfoEl.querySelector(".quest-link-banner");
                if (banner) {
                  banner.addEventListener("click", (e) => {
                    e.stopPropagation();
                    import("../quest-guide/index.js").then(({ openQuestGuide }) => {
                      openQuestGuide(quest.id);
                    });
                  });
                }
              }
            });
          });
        }
      }
    });
  }
};

document.addEventListener("click", (e) => {
  const targetElement =
    e.target instanceof Element
      ? e.target.closest("[data-action]")
      : null;
  if (!targetElement || !(targetElement instanceof HTMLElement)) return;

  const target = targetElement;
  const action = target.dataset.action;
  const itemId = target.dataset.itemId;
  const popupContainer = target.closest(".popup-container");

  e.stopPropagation();

  switch (action) {
    case "lightbox":
      if (target instanceof HTMLImageElement || target.querySelector("img")) {
        const img =
          target instanceof HTMLImageElement
            ? target
            : target.querySelector("img");
        if (img) resetGif(img);
      }
      openLightbox(parseInt(itemId), parseInt(target.dataset.index));
      break;
    case "video-lightbox":
      openVideoLightbox(target.dataset.src);
      break;
    case "switch-image":
      switchImage(target, parseInt(target.dataset.dir));
      break;
    case "toggle-media-view": {
      const view = target.dataset.view;
      const mediaSection = target.closest('.wiki-media-section');
      if (mediaSection) {
        const content = mediaSection.querySelector('.wiki-media-content');
        const buttons = mediaSection.querySelectorAll('.wiki-media-toggle button');
        buttons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        content.className = `wiki-media-content ${view}-view`;

        // When switching to slide-view, ensure only the active slide is visible
        if (view === "slide") {
          const container = content.querySelector('.popup-image-container');
          const idx = 0;
          if (container) {
            container.setAttribute('data-idx', String(idx));
            const images = container.querySelectorAll('.popup-media');
            images.forEach((img, i) => {
              if (i === idx) img.classList.add('active');
              else img.classList.remove('active');
            });
            const counter = container.querySelector('.img-counter');
            if (counter) counter.textContent = `1 / ${images.length}`;
          }
        }
      }
      break;
    }
    case "translate":
      const translateType = target.dataset.translateType || "ai";
      translateItem(parseInt(itemId), translateType);
      break;
    case "open-modal":
      openRelatedModal(target.dataset.category);
      break;
    case "toggle-guide":
      document
        .getElementById(target.dataset.target)
        ?.classList.toggle("hidden");
      break;
    case "reveal-spoiler":
      target.classList.add("revealed");
      break;
    case "toggle-sticker":
      toggleStickerModal(parseInt(itemId));
      break;
    case "toggle-fav":
      toggleFavorite(parseInt(itemId));
      break;
    case "toggle-complete":
      toggleCompleted(itemId);
      break;
    case "share":
      shareLocation(parseInt(itemId));
      break;

    case "add-to-route":
      import("../route/index.js")
        .then((routeModule) => {
          if (routeModule.isManualRouteMode()) {
            const added = routeModule.addToManualRoute(itemId);
            if (added) {
              target.textContent = "✓";
              target.style.background = "var(--success)";
              target.style.color = "white";
            }
          } else {
            alert(
              '수동 경로 구성 모드가 아닙니다. 경로 모드에서 "직접 구성"을 선택해주세요.',
            );
          }
        })
        .catch((err) => {
          console.error("Route module load failed:", err);
          alert("경로 모듈을 불러올 수 없습니다.");
        });
      break;
    case "vote":
      const type = target.dataset.type;
      const isBackend = target.dataset.isBackend === "true";
      toggleVote(itemId, type, isBackend).then((result) => {
        const voteContainer = target.closest(".vote-container");
        if (voteContainer && result && result.counts) {
          const upBtn = voteContainer.querySelector(".btn-up");
          const downBtn = voteContainer.querySelector(".btn-down");
          const upCount = upBtn.querySelector(".vote-count");
          const downCount = downBtn.querySelector(".vote-count");

          if (upCount) upCount.textContent = String(result.counts.up);
          if (downCount) downCount.textContent = String(result.counts.down);

          if (upBtn)
            upBtn.classList.toggle("active", result.userVote === "up");
          if (downBtn)
            downBtn.classList.toggle("active", result.userVote === "down");
        }
      });
      break;
    case "switch-report": {
      const reportId = target.dataset.reportId;
      const mainItemId = target.dataset.itemId;

      // Try to find the master item in lastRenderedItems (which has the aggregated data)
      let masterItem = state.lastRenderedItems.find((it) => String(it.id) === String(mainItemId));

      // Fallback to other sources
      if (!masterItem) {
        const items = state.mapData?.items || [];
        masterItem = items.find((it) => String(it.id) === String(mainItemId));
      }

      if (!masterItem && state.communityMarkers) {
        masterItem = state.communityMarkers.get(String(mainItemId));
      }

      if (masterItem && state.map) {
        // Use getPopup() or fall back to internal _popup for Leaflet
        const popup = state.map.getPopup ? state.map.getPopup() : state.map._popup;
        if (popup) {
          const latlng = popup.getLatLng();
          const newHtml = createPopupHtml(
            masterItem,
            latlng.lat,
            latlng.lng,
            masterItem.forceRegion || masterItem.region,
            reportId,
          );
          popup.setContent(newHtml);

          // Re-observe for lazy loading in the updated content
          const element = popup.getElement();
          if (element) {
            lazyLoader.observeAll(".lazy-load", element);
          }
        }
      }
      break;
    }

    case "open-edit-modal": {
      const isOfficial = target.dataset.isOfficial === "true";
      // @ts-ignore
      import("../ui/wiki.js").then(({ openWikiEditModal }) => {
        openWikiEditModal(itemId, isOfficial);
      });
      break;
    }

    case "open-history-modal": {
      // @ts-ignore
      import("../ui/wiki.js").then(({ openWikiHistoryModal }) => {
        openWikiHistoryModal(itemId);
      });
      break;
    }

    case "admin-delete":
      if (confirm("정말 이 마커를 영구 삭제하시겠습니까?")) {
        import("../auth.js").then(async ({ getAuthToken }) => {
          const token = await getAuthToken();
          fetch(`${BACKEND_URL}/api/admin/markers/${itemId}`, {
            method: "DELETE",
            credentials: "include",
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
          }).then(res => res.json()).then(data => {
            if (data.success) {
              alert("삭제되었습니다.");
              state.map.closePopup();
              import("../map/community.js").then(m => m.fetchCommunityMarkers().then(() => {
                import("../map/markers.js").then(mm => mm.renderMapDataAndMarkers());
              }));
            } else alert("오류: " + data.error);
          });
        });
      }
      break;

    case "admin-approve":
      import("../auth.js").then(async ({ getAuthToken }) => {
        const token = await getAuthToken();
        fetch(`${BACKEND_URL}/api/admin/markers/${itemId}/approve`, {
          method: "POST",
          credentials: "include",
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        }).then(res => res.json()).then(data => {
          if (data.success) {
            alert("승인되었습니다.");
            state.map.closePopup();
            import("../map/community.js").then(m => m.fetchCommunityMarkers().then(() => {
              import("../map/markers.js").then(mm => mm.renderMapDataAndMarkers());
            }));
          } else alert("오류: " + data.error);
        });
      });
      break;

    case "admin-reject":
      if (confirm("이 제보를 거부하시겠습니까?")) {
        import("../auth.js").then(async ({ getAuthToken }) => {
          const token = await getAuthToken();
          fetch(`${BACKEND_URL}/api/admin/markers/${itemId}/reject`, {
            method: "POST",
            credentials: "include",
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
          }).then(res => res.json()).then(data => {
            if (data.success) {
              alert("거부되었습니다.");
              state.map.closePopup();
              import("../map/community.js").then(m => m.fetchCommunityMarkers().then(() => {
                import("../map/markers.js").then(mm => mm.renderMapDataAndMarkers());
              }));
            } else alert("오류: " + data.error);
          });
        });
      }
      break;

    case "admin-block-user": {
      const userId = target.dataset.userId;
      if (!userId || userId === "null") {
        alert("유저 ID가 없는 마커입니다.");
        break;
      }
      const reason = prompt("이 유저를 차단하시겠습니까? 사유를 입력하세요:");
      if (reason) {
        import("../auth.js").then(async ({ getAuthToken }) => {
          const token = await getAuthToken();
          fetch(`${BACKEND_URL}/api/admin/users/block`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ userId, reason }),
            credentials: "include"
          }).then(res => res.json()).then(data => {
            if (data.success) alert(`유저(${userId})가 차단되었습니다.\n사유: ${reason}`);
            else alert("오류: " + data.error);
          });
        });
      }
      break;
    }
  }
});

document.addEventListener("submit", (e) => {
  const form = /** @type {HTMLElement} */ (
    /** @type {HTMLElement} */ (e.target).closest(".comment-form")
  );
  if (form) {
    e.preventDefault();
    const itemId = form.dataset.itemId;
    if (itemId && submitAnonymousComment) {
      submitAnonymousComment(e, parseInt(itemId));
    }
  }
});
