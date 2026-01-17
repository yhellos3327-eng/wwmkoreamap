/**
 * 패치 노트 관리 모듈
 * GitHub API를 통해 Merged PR 정보를 가져와서 패널에 표시합니다.
 */

const REPO_OWNER = "yhellos3327-eng";
const REPO_NAME = "wwmkoreamap";

export const loadPatchNotes = async () => {
  try {
    // Merged된 PR만 가져오기 (최신순 30개)
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=updated&direction=desc&per_page=30`,
    );

    if (!response.ok) throw new Error("GitHub API 호출 실패");

    const pulls = await response.json();

    // Merged된 PR이고, CodeRabbit 요약이 있는 것만 필터링
    const patchNotes = pulls
      .filter((pr) => pr.merged_at !== null) // Merge된 것만
      .map((pr) => {
        const body = pr.body || "";
        // CodeRabbit 요약 추출 (Walkthrough 또는 Summary 섹션)
        const summaryMatch = body.match(
          /## (Summary|Walkthrough|Changes)([\s\S]*?)(##|$)/i,
        );

        // 요약이 없으면 스킵 (또는 제목만 표시하려면 로직 변경 가능)
        if (!summaryMatch) return null;

        return {
          id: pr.number,
          date: new Date(pr.merged_at).toISOString().split("T")[0],
          title: pr.title,
          content: summaryMatch[2].trim(),
          url: pr.html_url,
          author: pr.user.login,
        };
      })
      .filter((note) => note !== null); // null 제거

    return patchNotes;
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

  const notes = await loadPatchNotes();

  if (notes.length === 0) {
    container.innerHTML =
      '<p class="empty-notes" style="padding: 20px; text-align: center; color: var(--text-muted);">아직 업데이트 내역이 없습니다.</p>';
    return;
  }

  container.innerHTML = notes
    .map(
      (note) => `
    <div class="patch-note-item" style="padding: 20px; border-bottom: 1px solid var(--glass-border);">
      <div class="note-header" style="display: flex; gap: 10px; margin-bottom: 8px; font-size: 0.9em;">
        <span class="note-version" style="background: var(--accent); color: black; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 0.8em;">PR #${note.id}</span>
        <span class="note-date" style="color: var(--text-muted);">${note.date}</span>
      </div>
      <h4 class="note-title" style="margin: 0 0 12px 0; font-size: 1.1em; color: var(--text-main);">${note.title}</h4>
      <div class="note-body markdown-body" style="background: var(--bg-secondary); padding: 15px; border-radius: 12px; font-size: 0.95em; line-height: 1.6; color: var(--text-main); margin-bottom: 12px; white-space: pre-wrap;">${formatContent(note.content)}</div>
      <a href="${note.url}" target="_blank" class="note-link" style="color: var(--accent); text-decoration: none; font-size: 0.9em; display: inline-flex; align-items: center; gap: 4px;">
        GitHub에서 보기 
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    </div>
  `,
    )
    .join("");
};

// 간단한 마크다운 포맷터
const formatContent = (text) => {
  if (!text) return "";
  let content = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  content = content.replace(/\n/g, "<br>");
  return content;
};
