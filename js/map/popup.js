import { state } from "../state.js";
import { t, getJosa, parseMarkdown } from "../utils.js";
import { formatCompletedTime } from "../ui/navigation.js";
import {
  openLightbox,
  openVideoLightbox,
  switchImage,
  translateItem,
  openRelatedModal,
  toggleFavorite,
  toggleCompleted,
  shareLocation,
  openReportPage,
} from "../ui.js";
import { toggleStickerModal, submitAnonymousComment } from "../comments.js";
import { renderVoteButtons, toggleVote } from "../votes.js";
import { lazyLoader } from "../ui/lazy-loader.js";

export const createPopupHtml = (item, lat, lng, regionName) => {
  const isFav =
    state.favorites.includes(String(item.id)) ||
    state.favorites.includes(item.id);
  const completedItem = state.completedList.find(
    (c) => String(c.id) === String(item.id),
  );
  const isCompleted = !!completedItem;
  const completedTimeStr =
    completedItem && completedItem.completedAt
      ? formatCompletedTime(completedItem.completedAt)
      : "";
  const displayRegion = item.forceRegion || regionName;
  let translatedName = t(item.name);
  if (translatedName) {
    translatedName = translatedName.replace(/{region}/g, displayRegion);
  }
  const categoryName = t(item.category);

  let itemDescription = (item.description || "").trim();
  let replaceName = translatedName;
  const josa =
    typeof getJosa === "function" ? getJosa(translatedName, "으로/로") : "로";
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

  let mediaHtml = "";
  const mediaItems = [];

  if (item.images && item.images.length > 0) {
    item.images.forEach((src, idx) => {
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
          const placeholder =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          return `<img data-src="${media.src}" src="${placeholder}" class="popup-media lazy-load ${activeClass}" data-action="lightbox" data-item-id="${item.id}" data-index="${media.index}" alt="${translatedName}">`;
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
            thumbSrc = `https://www.youtube.com/embed/${ytId}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0`;
            lightboxSrc = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
          }

          if (videoSrc.includes("bilibili.com")) {
            const separator = videoSrc.includes("?") ? "&" : "?";
            lightboxSrc = videoSrc.replace(/&?autoplay=\d/, "");
            lightboxSrc += `${separator}autoplay=1&high_quality=1`;

            thumbSrc = videoSrc.replace(/&?autoplay=\d/, "");
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
            ${renderVoteButtons(item.id)}
        </div>
        ${relatedHtml}
        <div class="popup-actions">
            <button class="action-btn btn-fav ${isFav ? "active" : ""}" data-action="toggle-fav" data-item-id="${item.id}" title="즐겨찾기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="action-btn btn-complete ${isCompleted ? "active" : ""}" data-action="toggle-complete" data-item-id="${item.id}" title="완료 상태로 표시">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ${isCompleted ? `완료${completedTimeStr ? `<span class="completed-time">${completedTimeStr}</span>` : ""}` : "완료"}
            </button>
            <button class="action-btn btn-route" data-action="add-to-route" data-item-id="${item.id}" title="경로에 추가">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"></circle><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path></svg>
                경로
            </button>
            <button class="action-btn btn-share" data-action="share" data-item-id="${item.id}" title="위치 공유">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
        </div>
        <div class="popup-footer">
            <div class="footer-badges">
                <span class="badge">${categoryName}</span>
                <span class="badge">${t(displayRegion)}</span>
            </div>
            <button class="btn-report-styled" data-action="report" data-item-id="${item.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                오류 제보
            </button>
        </div>
    </div>
`;
};

export const initPopupEventDelegation = () => {
  if (state.map) {
    state.map.on("popupopen", (e) => {
      const popupNode = e.popup.getElement();
      if (popupNode) {
        lazyLoader.observeAll(".lazy-load", popupNode);
      }
    });
  }

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const itemId = target.dataset.itemId;
    const popupContainer = target.closest(".popup-container");

    e.stopPropagation();

    switch (action) {
      case "lightbox":
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
      case "report":
        openReportPage(parseInt(itemId));
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
        toggleVote(itemId, type).then((result) => {
          const voteContainer = target.closest(".vote-container");
          if (voteContainer && result && result.counts) {
            const upBtn = voteContainer.querySelector(".btn-up");
            const downBtn = voteContainer.querySelector(".btn-down");
            const upCount = upBtn.querySelector(".vote-count");
            const downCount = downBtn.querySelector(".vote-count");

            if (upCount) upCount.textContent = result.counts.up;
            if (downCount) downCount.textContent = result.counts.down;

            if (upBtn)
              upBtn.classList.toggle("active", result.userVote === "up");
            if (downBtn)
              downBtn.classList.toggle("active", result.userVote === "down");
          }
        });
        break;
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest(".comment-form");
    if (form) {
      e.preventDefault();
      const itemId = form.dataset.itemId;
      if (itemId && submitAnonymousComment) {
        submitAnonymousComment(e, parseInt(itemId));
      }
    }
  });
};
