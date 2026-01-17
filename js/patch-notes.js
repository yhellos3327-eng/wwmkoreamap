/**
 * 패치 노트 관리 모듈
 * GitHub API를 통해 Merged PR 정보를 가져와서 패널에 표시합니다.
 */

const REPO_OWNER = "yhellos3327-eng";
const REPO_NAME = "wwmkoreamap";

export const loadPatchNotes = async () => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=updated&direction=desc&per_page=30`,
    );

    if (!response.ok) throw new Error("GitHub API 호출 실패");

    const pulls = await response.json();

    const patchNotes = await Promise.all(
      pulls
        .filter((pr) => pr.merged_at !== null)
        .map(async (pr) => {
          let content = "";
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
          if (!content) {
            const body = pr.body || "";
            if (
              body.includes("coderabbit") ||
              body.includes("Walkthrough") ||
              body.includes("Summary")
            ) {
              content = body;
            }
          }
          if (!content) return null;
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
              const idx = content.indexOf(marker);
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

    return patchNotes.filter((note) => note !== null);
  } catch (error) {
    console.error("Patch notes load error:", error);
    return [];
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
    ]);
  } catch (e) {
    console.error("Failed to load libraries", e);
  }

  const notes = await loadPatchNotes();

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
    body.innerHTML = htmlContent;
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
