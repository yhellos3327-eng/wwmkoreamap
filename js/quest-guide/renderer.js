// @ts-check
import { parseQuestMarkdown } from "../utils.js";

/**
 * Render the quest list view.
 * @param {any[]} questLines
 * @param {any[]} categories
 * @param {Object} progress
 */
export const renderQuestList = (questLines, categories, progress) => {
  const container = document.getElementById("quest-guide-content");
  if (!container) return;

  if (!questLines || questLines.length === 0) {
    container.innerHTML = `
      <div class="quest-guide-empty">
        <div class="icon-mask"
          style="--mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/%3E%3Cpath d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/%3E%3C/svg%3E&quot;); width: 48px; height: 48px; opacity: 0.3;">
        </div>
        <p>등록된 퀘스트가 없습니다.</p>
      </div>
    `;
    return;
  }

  const categoryMap = {};
  categories.forEach((cat) => {
    categoryMap[cat.id] = cat.name;
  });

  const cards = questLines
    .map((quest) => {
      const completedSteps = (progress[quest.id] || []).length;
      const total = quest.stepCount || 0;
      const categoryName = categoryMap[quest.category] || quest.category;

      const thumbHtml = quest.thumbnail
        ? `<img src="${quest.thumbnail}" alt="${quest.title}">`
        : `<div class="icon-mask" style="--mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/%3E%3Cpath d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/%3E%3C/svg%3E&quot;); width: 24px; height: 24px;"></div>`;

      return `
        <div class="quest-list-card" data-action="open-quest" data-quest-id="${quest.id}">
          <div class="quest-list-thumb">${thumbHtml}</div>
          <div class="quest-list-info">
            <div class="quest-list-title">${quest.title}</div>
            <div class="quest-list-meta">
              <span class="quest-list-badge">${categoryName}</span>
              <span>${completedSteps} / ${total} 완료</span>
            </div>
          </div>
          <div class="quest-list-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `<div class="quest-list">${cards}</div>`;
};

/**
 * Render quest detail (blog-style).
 * @param {any} quest
 * @param {string[]} completedSteps
 * @param {Object} displayOptions
 * @param {number} [currentStepIdx=0]
 * @param {string} [currentFilter=""]
 */
export const renderQuestDetail = (
  quest,
  completedSteps,
  displayOptions,
  currentStepIdx = 0,
  currentFilter = "",
) => {
  const container = document.getElementById("quest-guide-content");
  if (!container) return;

  // Apply hide classes based on display options
  container.classList.toggle("quest-hide-images", !displayOptions.showImages);
  container.classList.toggle("quest-hide-videos", !displayOptions.showVideos);
  container.classList.toggle("quest-hide-coords", !displayOptions.showMapCoords);

  const total = quest.steps.length;
  const completedCount = completedSteps.length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Progress bar
  const progressHtml = `
    <div class="quest-progress">
      <div class="quest-progress-header">
        <span class="quest-progress-label">진행도</span>
        <span class="quest-progress-percent">${progressPercent}%</span>
      </div>
      <div class="quest-progress-bar">
        <div class="quest-progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `;

  // Description
  const descHtml = quest.description
    ? `<div class="quest-description">${quest.description}</div>`
    : "";

  // Filter
  const filterHtml = renderFilter(quest, currentFilter);

  // Steps
  const stepsHtml = quest.steps
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step }) =>
        !currentFilter || step.group === currentFilter || step.group === "skill",
    )
    .map(({ step, index }) =>
      renderStep(
        step,
        index,
        quest.id,
        completedSteps,
        displayOptions,
        currentStepIdx,
        currentFilter,
      ),
    )
    .join("");

  // Linked quests
  const linkedHtml = renderLinkedQuests(quest.linkedQuests);

  container.innerHTML = `
    <div class="quest-detail">
      ${progressHtml}
      ${descHtml}
      ${filterHtml}
      ${stepsHtml}
      ${linkedHtml}
    </div>
  `;

  // Trigger progress bar animation
  requestAnimationFrame(() => {
    const bar = container.querySelector(".quest-progress-fill");
    if (bar instanceof HTMLElement) {
      // Force reflow
      void bar.offsetWidth;
      bar.style.width = `${progressPercent}%`;
    }
  });
};

/**
 * Render filter bar for sub-groups.
 * @param {any} quest
 * @param {string} currentFilter
 * @returns {string}
 */
const renderFilter = (quest, currentFilter) => {
  const groups = new Set();
  quest.steps.forEach((s) => {
    if (s.group) groups.add(s.group);
  });
  if (groups.size === 0) return "";

  const groupLabels = {
    skill: "기본 무공",
    bomul: "손 안의 보물",
    gyeojassi: "영험한 겨자씨",
  };

  const buttons = [
    `<button class="quest-filter-btn ${!currentFilter ? "active" : ""}" data-action="quest-filter" data-group="">전체</button>`,
    ...Array.from(groups).map(
      (g) =>
        `<button class="quest-filter-btn ${currentFilter === g ? "active" : ""}" data-action="quest-filter" data-group="${g}">${groupLabels[g] || g}</button>`,
    ),
  ].join("");

  return `<div class="quest-filter-bar">${buttons}</div>`;
};

/**
 * Render a single step card.
 * @param {any} step
 * @param {number} index
 * @param {string} questId
 * @param {string[]} completedSteps
 * @param {Object} displayOptions
 * @returns {string}
 */
const renderStep = (
  step,
  index,
  questId,
  completedSteps,
  displayOptions,
  currentStepIdx = 0,
  currentFilter = "",
) => {
  const isCompleted = completedSteps.includes(step.id);
  const isActive = index === currentStepIdx;

  // Parse markdown content
  let contentHtml = "";
  if (step.content) {
    contentHtml = parseQuestMarkdown(step.content);
  }

  // External embed
  let embedHtml = "";
  if (step.externalEmbed) {
    const embedUrl = step.externalEmbed.url || step.externalEmbed;
    const embedType = step.externalEmbed.type || "iframe";
    if (embedType === "object") {
      embedHtml = `
        <div class="quest-step-embed">
          <object data="${embedUrl}" type="text/html" width="100%" height="100%">
            <p>콘텐츠를 불러올 수 없습니다. <a href="${embedUrl}" target="_blank">새 창에서 열기</a></p>
          </object>
        </div>
      `;
    } else {
      embedHtml = `
        <div class="quest-step-embed">
          <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
        </div>
      `;
    }
  }

  // Images
  let imagesHtml = "";
  if (step.images && step.images.length > 0 && displayOptions.showImages) {
    const imgs = step.images
      .map((src, idx) => {
        const isFirst = idx === 0 && !currentFilter; // Only eager if it's the absolute first
        const loading = isFirst ? "eager" : "lazy";
        const priority = isFirst ? 'fetchpriority="high"' : "";
        const className = `quest-step-image lazy-load`;
        return `<img src="${isFirst ? src : ""}" data-src="${src}" alt="${step.title}" loading="${loading}" ${priority} decoding="async" class="${className}" data-action="view-image">`;
      })
      .join("");
    imagesHtml = `<div class="quest-step-images">${imgs}</div>`;
  }

  // Videos
  let videosHtml = "";
  if (step.videos && step.videos.length > 0 && displayOptions.showVideos) {
    videosHtml = step.videos
      .map((url) => {
        let embedSrc = url;
        // YouTube
        const ytMatch = url.match(
          /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
        );
        if (ytMatch && ytMatch[1]) {
          const videoId = ytMatch[1];
          const timeMatch = url.match(/[?&](?:t|start)=(\d+)/);
          const startParam = timeMatch ? `&start=${timeMatch[1]}` : "";
          embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}${startParam}`;
        }
        // Bilibili
        if (url.includes("bilibili.com")) {
          const sep = url.includes("?") ? "&" : "?";
          embedSrc = url + `${sep}autoplay=1&loop=1&high_quality=1`;
        }
        return `
          <div class="quest-step-video">
            <iframe src="${embedSrc}" frameborder="0" allowfullscreen></iframe>
          </div>
        `;
      })
      .join("");
  }

  // Map button
  let mapBtnHtml = "";
  if (step.coordinates && displayOptions.showMapCoords) {
    mapBtnHtml = `
      <button class="quest-map-btn" data-action="quest-jump-to-map" data-step-index="${index}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        지도에서 보기
      </button>
    `;
  }

  // Tips
  let tipHtml = "";
  if (step.tips) {
    tipHtml = `<div class="quest-step-tip">${parseQuestMarkdown(step.tips)}</div>`;
  }

  return `
    <div class="quest-step-card ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}"
         data-step-index="${index}" data-action="quest-step-click">
      <div class="quest-step-number ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}">${step.order}</div>
      <div class="quest-step-content-box">
        <div class="quest-step-header">
          <span class="quest-step-title">${step.title}</span>
          <button class="quest-step-complete-btn ${isCompleted ? "completed" : ""}"
                  data-action="quest-step-complete"
                  data-quest-id="${questId}"
                  data-step-id="${step.id}"
                  title="${isCompleted ? "완료 취소" : "완료로 표시"}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </div>
        <div class="quest-step-body">
          ${contentHtml}
        </div>
        ${imagesHtml}
        ${videosHtml}
        ${embedHtml}
        ${mapBtnHtml}
        ${tipHtml}
      </div>
    </div>
  `;
};

/**
 * Render linked quests section.
 * @param {string[]|undefined} linkedIds
 * @returns {string}
 */
const renderLinkedQuests = (linkedIds) => {
  if (!linkedIds || linkedIds.length === 0) return "";

  const cards = linkedIds
    .map(
      (id) => `
      <div class="quest-linked-card" data-action="quest-open-linked" data-quest-id="${id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        <span class="quest-linked-card-title">${id}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `,
    )
    .join("");

  return `
    <div class="quest-linked-section">
      <div class="quest-linked-title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        연계 퀘스트
      </div>
      ${cards}
    </div>
  `;
};

/**
 * Update step highlight (active state).
 * @param {number} activeIndex
 */
export const updateStepHighlight = (activeIndex) => {
  const cards = document.querySelectorAll(".quest-step-card");
  cards.forEach((card, i) => {
    card.classList.toggle("active", i === activeIndex);
    const num = card.querySelector(".quest-step-number");
    if (num) num.classList.toggle("active", i === activeIndex);
    const box = card.querySelector(".quest-step-content-box");
    if (box) box.classList.toggle("active", i === activeIndex);
  });
};
