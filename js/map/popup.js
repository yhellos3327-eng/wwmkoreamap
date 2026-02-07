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
 * Creates the HTML content for a marker popup.
 * @param {MapItem} item - The map item.
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {string} regionName - Region name.
 * @returns {string} The HTML string.
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

      itemDescription = itemDescription.replace(/\n/g, "<br>");

      itemDescription = itemDescription.replace(
        /{spoiler}([\s\S]*?){\/spoiler}/g,
        '<span class="spoiler" data-action="reveal-spoiler">$1</span>',
      );
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

  if (mediaItems.length > 0) {
    const slides = mediaItems
      .map((media, index) => {
        const activeClass = index === 0 ? "active" : "";

        if (media.type === "image") {
          let imgSrc = media.src;
          if (imgSrc && !imgSrc.startsWith("http") && !imgSrc.startsWith("data:") && !imgSrc.startsWith("/")) {
            // Assume it's a domain-relative or absolute URL needing protocol if it looks like one, or just prepend relative path?
            // If it starts with 'assets.wwmmap.kr', it definitely needs https://
            if (imgSrc.startsWith("assets.wwmmap.kr")) {
              imgSrc = "https://" + imgSrc;
            }
          }

          const placeholder =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
            <div class="translate-buttons" style="display: flex; gap: 8px;">
                <button class="btn-translate btn-translate-chrome" data-action="translate" data-translate-type="chrome" data-item-id="${item.id}" 
                    title="Chrome 내장 번역&#10;• 무료, 빠름&#10;• 단순 번역만 가능&#10;• 게임 용어 인식 불가"
                    style="flex:1; padding:6px 8px; background:rgba(66,133,244,0.1); border:1px solid rgba(66,133,244,0.4); color:#4285f4; border-radius:6px; cursor:pointer; font-size: 0.8em; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                        <rect x="9" y="9" width="6" height="6"></rect>
                        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"></path>
                    </svg>
                    <span class="btn-text">내장</span>
                </button>
                <button class="btn-translate btn-translate-ai" data-action="translate" data-translate-type="ai" data-item-id="${item.id}"
                    title="AI 번역 (권장)&#10;• API 키 필요&#10;• 게임 용어 사전 참조&#10;• 문맥 인식, 정확한 번역"
                    style="flex:1; padding:6px 8px; background:var(--accent-bg); border:1px solid var(--accent); color:var(--accent); border-radius:6px; cursor:pointer; font-size: 0.8em; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                        <circle cx="8.5" cy="15.5" r="1.5"></circle>
                        <circle cx="15.5" cy="15.5" r="1.5"></circle>
                        <path d="M8.5 11V7a3.5 3.5 0 0 1 7 0v4"></path>
                        <path d="M12 3v2"></path>
                        <path d="M3 15h-2M23 15h-2"></path>
                    </svg>
                    <span class="btn-text">AI</span>
                </button>
            </div>
        `;
  }

  let relatedHtml = "";
  if (state.showComments) {
    relatedHtml = `
        <div class="popup-related">
            <div class="popup-related-header">
                <h5>
                    <span style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>이정표</span>
                    <button class="btn-search-modal" data-action="open-modal" data-category="${item.category}" title="전체 목록 검색">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                </h5>
            </div>
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

                <form class="comment-form" data-item-id="${item.id}">
                    <div class="comment-input-group">
                        <input type="text" class="comment-nickname" placeholder="닉네임" maxlength="8">
                        <input type="password" class="comment-password" placeholder="비밀번호" maxlength="16" title="삭제 시 필요">
                        <button type="button" class="btn-guide" data-action="toggle-guide" data-target="comment-guide-${item.id}" title="작성 가이드">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </button>
                    </div>
                    <div class="comment-input-wrapper" style="position: relative;">
                        <div id="sticker-modal-${item.id}" class="sticker-modal">
                            <div class="sticker-grid" id="sticker-grid-${item.id}">
                                <!-- Stickers will be loaded here -->
                            </div>
                        </div>
                        <button type="button" class="btn-sticker" data-action="toggle-sticker" data-item-id="${item.id}" title="스티커">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                        </button>
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
    : `<div class="popup-content">${itemDescription}</div>`;

  let aggregatedReportsHtml = "";
  if (item.aggregated && item.aggregated.length > 0) {
    const allReports = [item, ...item.aggregated];
    const listItems = allReports
      .map((report) => {
        const isActive = String(report.id) === String(displayItem.id);
        const reportAuthor = report.user_id || "Anonymous";
        const reportTitle = t(report.name) || "제보 내용";

        return `
          <div class="report-item ${isActive ? "active" : ""}" 
               data-action="switch-report" 
               data-item-id="${item.id}" 
               data-report-id="${report.id}"
               style="padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; border: 1px solid ${isActive ? "var(--accent)" : "rgba(255,255,255,0.05)"}; background: ${isActive ? "rgba(255,187,0,0.1)" : "rgba(255,255,255,0.03)"};">
              <div class="report-author-icon" style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: ${isActive ? "var(--accent)" : "rgba(255,255,255,0.1)"}; display: flex; align-items: center; justify-content: center;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isActive ? "#000" : "currentColor"}" stroke-width="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 11px; font-weight: 700; color: ${isActive ? "var(--accent)" : "#eee"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${reportTitle}</div>
                  <div style="font-size: 9px; color: rgba(255,255,255,0.5);">${reportAuthor}</div>
              </div>
              ${isActive ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ""}
          </div>
        `;
      })
      .join("");

    aggregatedReportsHtml = `
      <div class="popup-aggregated-section" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
          <h5 style="margin: 0 0 8px 4px; font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              이 위치의 다른 제보 (${allReports.length})
          </h5>
          <div class="report-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto; padding-right: 4px;">
              ${listItems}
          </div>
      </div>
    `;
  }

  return `
    <div class="popup-container" data-id="${item.id}" data-lat="${lat}" data-lng="${lng}">
        <div class="popup-header">
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="./icons/${displayItem.category}.png" class="popup-icon" alt="${categoryName}" onerror="this.style.display='none'">
                <div style="display:flex; flex-direction:column; gap: 4px;">
                    <h4 style="margin:0;">${translatedName}</h4>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${displayItem.user_id ? `
                            <div class="author-profile" style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span style="font-size: 10px; font-weight: 600; color: #eee; letter-spacing: -0.2px;">${displayItem.user_id}</span>
                            </div>
                        ` : ''} 
                        ${displayItem.id !== item.id ? '<span style="font-size: 10px; color: var(--accent); font-weight: 700; background: rgba(255, 187, 0, 0.15); padding: 2px 6px; border-radius: 12px;">중복 제보</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
        <div class="popup-quest-info hidden" data-item-id="${item.id}">
            <!-- Quest info loaded via JS -->
        </div>
        <div class="popup-body">
            ${mediaHtml}
            ${bodyContent}
            ${translateBtnHtml}
            ${renderVoteButtons(displayItem.id, false, !!displayItem.isBackend)}
            ${aggregatedReportsHtml}
        </div>
        ${relatedHtml}
        <div class="popup-actions">
            <button class="action-btn btn-fav ${isFav ? "active" : ""}" data-action="toggle-fav" data-item-id="${displayItem.id}" title="즐겨찾기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="action-btn btn-complete ${isCompleted ? "active" : ""}" data-action="toggle-complete" data-item-id="${completedId}" title="완료 상태로 표시">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ${isCompleted ? `완료${completedTimeStr ? `<span class="completed-time">${completedTimeStr}</span>` : ""}` : "완료"}
            </button>
            <button class="action-btn btn-route" data-action="add-to-route" data-item-id="${displayItem.id}" title="경로에 추가">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"></circle><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path></svg>
                경로
            </button>
            <button class="action-btn btn-share" data-action="share" data-item-id="${item.id}" title="위치 공유">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
        </div>
        ${(() => {
      if (displayItem.isBackend && isAdminUser()) {
        return `
              <div class="admin-actions" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                  <div style="font-size: 10px; font-weight: bold; color: #ff6b6b; margin-bottom: 5px; text-transform: uppercase;">Admin Tools</div>
                  <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                      <button class="action-btn" data-action="admin-delete" data-item-id="${displayItem.id}" style="background: rgba(255,0,0,0.2); color: #ff6b6b; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(255,0,0,0.3);">삭제</button>
                      ${displayItem.status === 'pending' || displayItem.status === 'rejected' ? `<button class="action-btn" data-action="admin-approve" data-item-id="${displayItem.id}" style="background: rgba(0,255,0,0.2); color: #4ade80; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(0,255,0,0.3);">승인</button>` : ''}
                      ${displayItem.status !== 'rejected' ? `<button class="action-btn" data-action="admin-reject" data-item-id="${displayItem.id}" style="background: rgba(255,165,0,0.2); color: #fb923c; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(255,165,0,0.3);">거부</button>` : ''}
                      <button class="action-btn" data-action="admin-block-user" data-user-id="${displayItem.user_id}" style="background: rgba(100,100,100,0.2); color: #aaa; font-size: 11px; padding: 4px 8px; margin-left: auto; border: 1px solid rgba(255,255,255,0.1);">유저 차단</button>
                  </div>
              </div>
            `;
      }
      return '';
    })()}
        <div class="popup-footer">
            <div class="footer-badges">
                <span class="badge">${categoryName}</span>
                <span class="badge">${t(displayRegion)}</span>
            </div>

        </div>
    </div>
`;
};

/**
 * Initializes popup event delegation.
 */
export const initPopupEventDelegation = () => {
  if (state.map) {
    state.map.on("popupopen", (e) => {
      const popupNode = e.popup.getElement();
      if (popupNode) {
        lazyLoader.observeAll(".lazy-load", popupNode);

        // Fetch votes for community markers to ensure fresh data
        const voteContainer = popupNode.querySelector(".vote-container");
        if (voteContainer && voteContainer.dataset.isBackend === "true") {
          const itemId = voteContainer.dataset.itemId;
          if (itemId) fetchVoteCounts(itemId, true);
        }

        // Check for quest info
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
                // Allow clicking the banner to open the quest
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
    e.target instanceof HTMLElement
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
