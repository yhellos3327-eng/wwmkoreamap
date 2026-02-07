// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { resetGif } from "../utils.js";

/**
 * @typedef {import("../data/processors.js").MapItem} MapItem
 */

/**
 * @typedef {Object} MediaItem
 * @property {string} type
 * @property {string} src
 */

/**
 * Updates the lightbox image content.
 */
function updateLightboxImage() {
  const container = document.getElementById("lightbox-media-container");
  if (!container) return;

  const mediaList = /** @type {MediaItem[]} */ (state.currentLightboxMedia);
  const index = state.currentLightboxIndex;

  if (mediaList && mediaList[index]) {
    const media = mediaList[index];
    container.innerHTML = "";

    if (media.type === "image") {
      const img = document.createElement("img");
      img.src = media.src;
      img.className = "lightbox-content";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "100%";
      img.style.objectFit = "contain";

      // Allow re-playing GIFs on click
      img.onclick = () => resetGif(img);
      if (img.src.toLowerCase().includes(".gif")) {
        img.style.cursor = "pointer";
        img.title = "Click to replay animation";
      }

      container.appendChild(img);
    } else if (media.type === "video") {
      let videoSrc = media.src.replace(/^http:/, "https:");
      if (videoSrc.startsWith("//")) videoSrc = "https:" + videoSrc;

      let embedSrc = videoSrc;

      const ytMatch = videoSrc.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      );
      if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1];
        // Extract start time from t= or start= parameter
        const timeMatch = videoSrc.match(/[?&](?:t|start)=(\d+)/);
        const startTime = timeMatch ? timeMatch[1] : null;
        const startParam = startTime ? `&start=${startTime}` : "";
        // YouTube requires both loop=1 and playlist=VIDEO_ID to loop
        embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}${startParam}`;
      }

      if (videoSrc.includes("bilibili.com")) {
        const separator = videoSrc.includes("?") ? "&" : "?";
        embedSrc = videoSrc.replace(/&?autoplay=\d/, "");
        // Add loop=1 for Bilibili
        embedSrc += `${separator}autoplay=1&loop=1&high_quality=1`;
      }

      const iframe = document.createElement("iframe");
      iframe.src = embedSrc;
      iframe.style.width = "80vw";
      iframe.style.height = "80vh";
      iframe.style.maxWidth = "1200px";
      iframe.style.maxHeight = "675px";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
  }
}

/**
 * Opens the lightbox for a specific item or image URL.
 * @param {string|number} itemId - The item ID or image URL.
 * @param {number} [index=0] - The initial media index.
 */
export const openLightbox = (itemId, index) => {
  if (
    typeof itemId === "string" &&
    (itemId.startsWith("http") ||
      itemId.startsWith("//") ||
      itemId.startsWith("./"))
  ) {
    setState("currentLightboxMedia", [{ type: "image", src: itemId }]);
    setState("currentLightboxIndex", 0);
    updateLightboxImage();
    const modal = document.getElementById("lightbox-modal");
    if (modal) {
      modal.classList.remove("hidden");
      const navBtns = modal.querySelectorAll(".lightbox-nav");
      navBtns.forEach((btn) => {
        /** @type {HTMLElement} */ (btn).style.display = "none";
      });
    }
    return;
  }

  let item = state.mapData.items.find((i) => i.id == itemId);

  // Fallback for Community Markers
  if (!item && state.communityMarkers) {
    item = state.communityMarkers.get(String(itemId));
  }

  if (!item) {
    console.warn("Lightbox: Item not found", itemId);
    return;
  }

  const mediaList = [];
  if (item.images && item.images.length > 0) {
    item.images.forEach((img) => {
      let src = img;
      if (src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("/")) {
        if (src.startsWith("assets.wwmmap.kr")) {
          src = "https://" + src;
        }
      }
      mediaList.push({ type: "image", src: src });
    });
  }

  if (item.video_url) {
    if (Array.isArray(item.video_url)) {
      item.video_url.forEach((url) => {
        if (url && typeof url === "string" && url.trim() !== "") {
          mediaList.push({ type: "video", src: url.trim() });
        }
      });
    } else if (
      typeof item.video_url === "string" &&
      item.video_url.trim() !== ""
    ) {
      mediaList.push({ type: "video", src: item.video_url.trim() });
    }
  }

  if (mediaList.length === 0) {
    console.warn("Lightbox: No media found for item", itemId);
    return;
  }

  setState("currentLightboxMedia", mediaList);
  setState("currentLightboxIndex", index || 0);

  updateLightboxImage();

  const modal = document.getElementById("lightbox-modal");
  if (modal) {
    modal.classList.remove("hidden");

    const navBtns = modal.querySelectorAll(".lightbox-nav");
    navBtns.forEach((btn) => {
      /** @type {HTMLElement} */ (btn).style.display =
        state.currentLightboxMedia.length > 1 ? "block" : "none";
    });
  }
};

/**
 * Switches the lightbox media by a direction.
 * @param {number} direction - The direction to switch (-1 or 1).
 */
export const switchLightbox = (direction) => {
  const total = state.currentLightboxMedia.length;
  if (total <= 1) return;

  let idx = state.currentLightboxIndex + direction;

  if (idx >= total) idx = 0;
  if (idx < 0) idx = total - 1;

  setState("currentLightboxIndex", idx);
  updateLightboxImage();
};

/**
 * Closes the lightbox.
 */
export const closeLightbox = () => {
  const modal = document.getElementById("lightbox-modal");
  if (modal) modal.classList.add("hidden");
  const container = document.getElementById("lightbox-media-container");
  if (container) container.innerHTML = "";
};

/**
 * Opens the video lightbox.
 * @param {string} src - The video URL.
 */
export const openVideoLightbox = (src) => {
  const modal = document.getElementById("video-lightbox-modal");
  const iframe = /** @type {HTMLIFrameElement} */ (
    document.getElementById("lightbox-video-frame")
  );
  if (modal && iframe) {
    iframe.src = src;
    modal.classList.remove("hidden");
  }
};

/**
 * Closes the video lightbox.
 */
export const closeVideoLightbox = () => {
  const modal = document.getElementById("video-lightbox-modal");
  const iframe = /** @type {HTMLIFrameElement} */ (
    document.getElementById("lightbox-video-frame")
  );
  if (modal && iframe) {
    modal.classList.add("hidden");
    iframe.src = "";
  }
};

/**
 * Views a full image in the lightbox.
 * @param {string} src - The image URL.
 */
export const viewFullImage = (src) => {
  const modal = document.getElementById("lightbox-modal");
  const img = /** @type {HTMLImageElement} */ (
    document.getElementById("lightbox-img")
  );
  if (img) img.src = src;
  if (modal) modal.classList.remove("hidden");
};

/**
 * Switches images within a popup.
 * @param {HTMLElement} btn - The button element.
 * @param {number} direction - The direction to switch (-1 or 1).
 */
export const switchImage = (btn, direction) => {
  const container = btn.parentElement;
  const images = container.querySelectorAll(".popup-media");
  const counter = container.querySelector(".img-counter");

  let currentIdx = parseInt(container.dataset.idx);
  const total = parseInt(container.dataset.total);

  images[currentIdx].classList.remove("active");
  currentIdx += direction;
  if (currentIdx >= total) currentIdx = 0;
  if (currentIdx < 0) currentIdx = total - 1;

  images[currentIdx].classList.add("active");
  resetGif(images[currentIdx]);

  container.dataset.idx = String(currentIdx);
  if (counter)
    /** @type {HTMLElement} */ (counter).innerText = `${currentIdx + 1} / ${total}`;
};

// Background loop to auto-restart GIFs that might have finished playing (for one-shot GIFs)
setInterval(() => {
  const activeSelectors = [
    ".popup-media.active",
    ".lightbox-content",
    ".quest-step-image",
  ];
  activeSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (
        el instanceof HTMLImageElement &&
        el.src.toLowerCase().includes(".gif")
      ) {
        // Only reset if visible in viewport
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          resetGif(el);
        }
      }
    });
  });
}, 20000);

