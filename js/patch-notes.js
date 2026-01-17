/**
 * 패치 노트 관리 모듈
 * GitHub API를 통해 Merged PR 정보를 가져와서 패널에 표시합니다.
 */

const REPO_OWNER = "yhellos3327-eng";
const REPO_NAME = "wwmkoreamap";
const CACHE_KEY = "patch_notes_cache";
const CACHE_TTL = 3600000; // 1시간 캐시

export const loadPatchNotes = async () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=updated&direction=desc&per_page=30`,
    );

    if (!response.ok) {
      if (
        response.status === 403 &&
        response.headers.get("X-RateLimit-Remaining") === "0"
      ) {
        throw new Error(
          "GitHub API 호출 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
      throw new Error(`GitHub API 호출 실패: ${response.status}`);
    }

    const pulls = await response.json();

    const patchNotes = await Promise.all(
      pulls
        .filter((pr) => pr.merged_at !== null)
        .map(async (pr) => {
          let content = "";

          // 1. PR 본문에서 먼저 확인 (API 호출 절약)
          const body = pr.body || "";
          if (
            body.includes("coderabbit") ||
            body.includes("Walkthrough") ||
            body.includes("Summary")
          ) {
            content = body;
          }

          // 2. 본문에 없으면 코멘트 확인
          if (!content) {
            try {
              const commentsRes = await fetch(pr.comments_url);
              if (commentsRes.ok) {
                const comments = await commentsRes.json();
                const rabbitComment = comments.find(
                  (c) =>
                    c.user?.login === "coderabbitai[bot]" &&
                    (c.body.includes("Walkthrough") ||
                      c.body.includes("Summary")),
                );

                if (rabbitComment) {
                  content = rabbitComment.body;
                }
              }
            } catch (e) {
              console.warn("Failed to fetch comments for PR #" + pr.number);
            }
          }

          if (!content) return null;

          // 콘텐츠 가공 로직
          if (content.includes("<!-- walkthrough_start -->")) {
            const start = content.indexOf("<!-- walkthrough_start -->");
            const endMarkers = [
              "## 검토 예상 소요 시간",
              '<h2 dir="auto">검토 예상 소요 시간</h2>',
              '<h2 dir="auto">Poem</h2>',
              "## 예상 코드 리뷰 노력",
              '<h2 dir="auto">예상 코드 리뷰 노력</h2>',
              "<!-- walkthrough_end -->",
            ];

            let end = -1;
            for (const marker of endMarkers) {
              const idx = content.indexOf(marker, start);
              if (idx !== -1 && (end === -1 || idx < end)) {
                end = idx;
              }
            }

            if (end > start) {
              content = content.substring(start, end);
            }
          } else {
            const match = content.match(
              /## (Summary|Walkthrough|Changes|릴리스 노트)([\s\S]*)/i,
            );
            if (match) {
              content = match[0];
            }
          }

          if (!content) return null;

          content = content.replace(/<!--[\s\S]*?-->/g, "");
          content = content
            .replace(/<details>/g, "")
            .replace(/<\/details>/g, "");
          content = content.replace(/<summary>.*?<\/summary>/g, "");

          return {
            id: pr.number,
            date: new Date(pr.merged_at).toISOString().split("T")[0],
            title: pr.title,
            content: content.trim(),
            url: pr.html_url,
            author: pr.user.login,
          };
        }),
    );

    const filteredNotes = patchNotes.filter((note) => note !== null);

    // 캐시 저장
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: filteredNotes }),
    );

    return filteredNotes;
  } catch (error) {
    console.error("Patch notes load error:", error);
    // 에러 발생 시 만료된 캐시라도 있으면 반환
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        return data;
      } catch (e) {}
    }
    throw error;
  }
};

export const initPatchNotesPanel = () => {
  const openBtn = document.getElementById("open-patch-notes");
  const closeBtn = document.getElementById("close-patch-notes-panel");
  const panel = document.getElementById("patch-notes-panel");
  const listContainer = document.getElementById("patch-notes-list");

  if (openBtn && panel) {
    openBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      panel.classList.toggle("open");

      if (panel.classList.contains("open")) {
        await renderPatchNotesList(listContainer);
      }
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
    });
  }
};

const renderPatchNotesList = async (container) => {
  if (!container) return;

  container.innerHTML =
    '<div class="loading-spinner" style="padding: 20px; text-align: center;">로딩 중...</div>';

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  try {
    await Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/marked/marked.min.js"),
      loadScript("https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"),
      loadScript(
        "https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.min.js",
      ),
    ]);
  } catch (e) {
    console.error("Failed to load libraries", e);
    container.innerHTML =
      '<div class="error-notes">필수 라이브러리를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.</div>';
    return;
  }

  // 라이브러리 로드 성공 후 객체 존재 여부 재확인
  if (!window.marked || !window.DOMPurify) {
    container.innerHTML =
      '<div class="error-notes">라이브러리 초기화에 실패했습니다.</div>';
    return;
  }

  let notes = [];
  try {
    notes = await loadPatchNotes();
  } catch (error) {
    container.innerHTML = `<div class="error-notes">${error.message}</div>`;
    return;
  }

  if (notes.length === 0) {
    container.innerHTML =
      '<p class="empty-notes" style="padding: 20px; text-align: center; color: var(--text-muted);">아직 업데이트 내역이 없습니다.</p>';
    return;
  }

  window.marked.use({
    renderer: {
      code(token) {
        if (token.lang === "mermaid") {
          return `<div class="mermaid">${token.text}</div>`;
        }
        return false;
      },
    },
  });

  const timelineContainer = document.createElement("div");
  timelineContainer.className = "timeline-container";

  for (const note of notes) {
    const htmlContent = await window.marked.parse(note.content);

    const item = document.createElement("div");
    item.className = "timeline-item";

    const marker = document.createElement("div");
    marker.className = "timeline-marker";
    item.appendChild(marker);

    const content = document.createElement("div");
    content.className = "timeline-content";

    const header = document.createElement("div");
    header.className = "timeline-header";

    const dateSpan = document.createElement("span");
    dateSpan.className = "timeline-date";
    dateSpan.textContent = note.date;

    const versionSpan = document.createElement("span");
    versionSpan.className = "timeline-version";
    versionSpan.textContent = `PR #${note.id}`;

    header.appendChild(dateSpan);
    header.appendChild(versionSpan);
    content.appendChild(header);

    const title = document.createElement("h3");
    title.className = "timeline-title";
    title.textContent = note.title;
    content.appendChild(title);

    const body = document.createElement("div");
    body.className = "timeline-body markdown-body";
    body.innerHTML = window.DOMPurify.sanitize(htmlContent);
    content.appendChild(body);

    item.appendChild(content);
    timelineContainer.appendChild(item);
  }

  container.innerHTML = "";
  container.appendChild(timelineContainer);

  if (window.mermaid) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      setTimeout(async () => {
        await window.mermaid.run({
          nodes: container.querySelectorAll(".mermaid"),
        });
      }, 10);
    } catch (err) {
      console.error("Mermaid rendering failed:", err);
    }
  }
};
