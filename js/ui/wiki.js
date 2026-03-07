// @ts-check
import { state } from "../state.js";
import { BACKEND_URL } from "../config.js";
import { getAuthToken, isLoggedIn } from "../auth.js";
import { t, parseMarkdown } from "../utils.js";

/**
 * Opens a modal to propose edits for a marker
 * @param {string|number} itemId
 * @param {boolean} isOfficial
 */
export const openWikiEditModal = async (itemId, isOfficial) => {
    if (!isLoggedIn()) {
        alert("위키 문서 수정을 제안하려면 먼저 로그인해야 합니다.");
        const authBtn = document.getElementById("auth-btn");
        if (authBtn) authBtn.click();
        return;
    }

    // Find the item
    let targetItem = null;
    if (isOfficial) {
        // Find in main data
        const items = state.mapData?.items || [];
        targetItem = items.find(it => String(it.id) === String(itemId));
    } else {
        // Find in community markers
        targetItem = state.communityMarkers?.get(String(itemId));
    }

    if (!targetItem) {
        alert("해당 마커 정보를 찾을 수 없습니다.");
        return;
    }

    // Modal HTML Structure
    const modalId = `wiki-edit-modal-${itemId}`;
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay list-modal-overlay active";
    overlay.id = modalId;
    overlay.style.zIndex = "10000";

    const currentTitle = t(targetItem.title || targetItem.name || "");
    const currentDesc = targetItem.description || "";

    const formHtml = `
        <div class="list-modal fade-in wiki-modal">
            <div class="wiki-modal-header">
                <h2>위키 편집 제안</h2>
                <button class="wiki-close-btn" id="close-${modalId}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="wiki-info-text">
                    이 마커(<strong style="color:var(--accent)">${currentTitle}</strong>)에 대한 더 정확한 정보나 수정 사항을 제안해주세요.
                    유저들의 <strong>추천을 일정 수 이상 받으면 공식 지도에 반영</strong>됩니다.
                </p>
                <form id="wiki-form-${itemId}">
                    <div class="wiki-form-group">
                        <label>제목</label>
                        <input type="text" id="wiki-title-${itemId}" class="wiki-input" value="${currentTitle}" placeholder="마커 이름">
                    </div>
                    
                    <div class="wiki-form-group">
                        <label>설명 (마크다운 지원) 및 미리보기</label>
                        <div class="wiki-editor-container">
                            <textarea id="wiki-desc-${itemId}" class="wiki-textarea wiki-editor-textarea" placeholder="자세한 위치나 팁을 적어주세요.">${currentDesc}</textarea>
                            <div id="wiki-preview-${itemId}" class="wiki-preview-content markdown-body"></div>
                        </div>
                    </div>

                    <div class="wiki-form-group">
                        <label>스크린샷 첨부 (선택)</label>
                        <input type="file" id="wiki-img-${itemId}" class="wiki-file-input" accept="image/jpeg, image/png, image/webp">
                    </div>

                    <div class="wiki-form-group">
                        <label>유튜브 동영상 링크 (선택)</label>
                        <input type="url" id="wiki-video-${itemId}" class="wiki-input" value="${targetItem.video_url || ''}" placeholder="https://youtube.com/watch?v=...">
                    </div>

                    <hr class="wiki-divider">

                    <div class="wiki-form-group">
                        <label>수정 사유 (필수)</label>
                        <input type="text" id="wiki-reason-${itemId}" class="wiki-input" placeholder="예: 오타 수정, 위치 상세 설명 추가 등" required>
                    </div>

                    <button type="submit" class="wiki-submit-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        <span>제안 제출하기</span>
                    </button>
                </form>
            </div>
        </div>
    `;

    overlay.innerHTML = formHtml;
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById(`close-${modalId}`);
    if (closeBtn) closeBtn.onclick = () => overlay.remove();

    const textDescEl = document.getElementById(`wiki-desc-${itemId}`);
    const previewEl = document.getElementById(`wiki-preview-${itemId}`);
    if (textDescEl && previewEl) {
        const updatePreview = () => {
            previewEl.innerHTML = parseMarkdown((/** @type {HTMLTextAreaElement} */ (textDescEl)).value);
        };
        textDescEl.addEventListener('input', updatePreview);
        updatePreview(); // Initial render
    }

    const form = document.getElementById(`wiki-form-${itemId}`);
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const titleEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-title-${itemId}`));
            const descEl = /** @type {HTMLTextAreaElement} */ (document.getElementById(`wiki-desc-${itemId}`));
            const imgEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-img-${itemId}`));
            const videoEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-video-${itemId}`));
            const reasonEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-reason-${itemId}`));
            const submitBtn = form.querySelector('button[type="submit"]');

            if (!reasonEl.value.trim()) {
                alert("수정 사유를 반드시 입력해주세요.");
                return;
            }

            if (submitBtn) {
                // @ts-ignore
                submitBtn.disabled = true;
                submitBtn.textContent = "제출 중...";
            }

            try {
                const token = await getAuthToken();
                const formData = new FormData();

                formData.append('target_marker_id', String(itemId));
                formData.append('is_official', String(isOfficial));
                formData.append('title', titleEl.value.trim());
                formData.append('description', descEl.value.trim());
                formData.append('video', videoEl.value.trim());
                formData.append('edit_reason', reasonEl.value.trim());

                if (imgEl.files && imgEl.files.length > 0) {
                    formData.append('screenshot', imgEl.files[0]);
                }

                const res = await fetch(`${BACKEND_URL}/api/revisions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await res.json();
                if (data.success) {
                    alert("수정 제안이 제출되었습니다! 유저들의 추천을 받으면 반영됩니다.");
                    overlay.remove();
                } else {
                    alert("제출 실패: " + (data.error || "알 수 없는 오류"));
                    if (submitBtn) {
                        // @ts-ignore
                        submitBtn.disabled = false;
                        submitBtn.textContent = "제안 제출하기";
                    }
                }
            } catch (err) {
                console.error("Wiki submit error:", err);
                alert("서버 연결에 실패했습니다.");
                if (submitBtn) {
                    // @ts-ignore
                    submitBtn.disabled = false;
                    submitBtn.textContent = "제안 제출하기";
                }
            }
        };
    }
};

/**
 * Opens a modal showing the revision history for a specific marker
 * @param {string|number} itemId
 */
export const openWikiHistoryModal = async (itemId) => {
    const modalId = `wiki-history-modal-${itemId}`;
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay list-modal-overlay active";
    overlay.id = modalId;
    overlay.style.zIndex = "10000";

    const loadingHtml = `
        <div class="list-modal fade-in wiki-modal" style="text-align: center;">
            <div class="wiki-modal-header">
                <h2>수정 역사 기록</h2>
                <button class="wiki-close-btn" id="close-${modalId}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p>로딩 중...</p>
            </div>
        </div>
    `;

    overlay.innerHTML = loadingHtml;
    document.body.appendChild(overlay);

    const closeLoadingBtn = document.getElementById(`close-${modalId}`);
    if (closeLoadingBtn) closeLoadingBtn.onclick = () => overlay.remove();

    try {
        const res = await fetch(`${BACKEND_URL}/api/revisions/target/${itemId}`);
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        let listHtml = "";
        if (data.history && data.history.length > 0) {
            listHtml = data.history.map(rev => {
                const date = new Date(rev.created_at).toLocaleString('ko-KR');
                const stateColor =
                    rev.status === 'approved' ? 'color: #4ade80;' : // green
                        rev.status === 'rejected' ? 'color: #f87171;' : // red
                            rev.status === 'reverted' ? 'color: #9ca3af;' : // gray
                                'color: #fbbf24;'; // yellow pending

                const stateText =
                    rev.status === 'approved' ? '승인됨 (적용중)' :
                        rev.status === 'rejected' ? '반려됨' :
                            rev.status === 'reverted' ? '되돌려짐' :
                                '검토 대기중';

                const safeName = rev.display_name || `User#${rev.user_id}`;

                let adminBtn = "";
                // To keep this generic, if there's an active token and role is admin, we render rollback button
                import("../auth.js").then(({ isAdminUser }) => {
                    if (isAdminUser() && rev.status !== 'reverted') {
                        // Admin could revert to this specific revision
                        // We render it dynamically below after the HTML is added
                    }
                });

                return `
                    <div class="wiki-history-item">
                        <div class="wiki-history-header">
                            <span class="wiki-history-date">${date}</span>
                            <span class="wiki-history-status" style="${stateColor}">${stateText}</span>
                        </div>
                        <div class="wiki-history-contributor">
                            기여자: <span style="color: var(--accent);">${safeName}</span>
                        </div>
                        <div class="wiki-history-reason">
                            사유: ${rev.edit_reason || "사유 없음"}
                        </div>
                        <div class="wiki-history-changes">
                            수정 항목: 
                            ${rev.revision_data.title ? `제목, ` : ''}
                            ${rev.revision_data.description ? `설명, ` : ''}
                            ${rev.revision_data.screenshot ? `이미지, ` : ''}
                            ${rev.revision_data.video ? `영상 ` : ''}
                        </div>
                        ${rev.status === 'pending' ? `
                           <div class="wiki-history-votes">
                                <span class="wiki-vote-badge wiki-vote-up">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                    추천 ${rev.votes}/5
                                </span>
                                <span class="wiki-vote-badge wiki-vote-down">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg>
                                    신고 ${rev.reports}/3
                                </span>
                           </div>
                        ` : ''}
                        <div class="admin-rollback-slot" data-rev-id="${rev.id}"></div>
                    </div>
                `;
            }).join('');
        } else {
            listHtml = `<p class="wiki-empty">이 마커의 수정 기록이 없습니다.</p>`;
        }

        const modalHtml = `
            <div class="list-modal fade-in wiki-modal">
                <div class="wiki-modal-header">
                    <h2>수정 역사 기록</h2>
                    <button class="wiki-close-btn" id="close-${modalId}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="wiki-history-body">
                    ${listHtml}
                </div>
            </div>
        `;

        overlay.innerHTML = modalHtml;

        const closeBtn = document.getElementById(`close-${modalId}`);
        if (closeBtn) closeBtn.onclick = () => overlay.remove();

        // Inject Admin buttons if authorized
        import("../auth.js").then(({ isAdminUser, getAuthToken }) => {
            if (isAdminUser()) {
                overlay.querySelectorAll('.admin-rollback-slot').forEach(slot => {
                    const revId = /** @type {HTMLElement} */(slot).dataset.revId;
                    const btn = document.createElement("button");
                    btn.className = "action-btn-small wiki-admin-revert-btn";
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>이 버전으로 강제 되돌리기 (Admin)`;

                    btn.onclick = async () => {
                        if (!confirm(`정말 이 리비전(#${revId}) 상태로 마커를 완전히 되돌리시겠습니까?`)) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}/revert`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("성공적으로 되돌렸습니다. 새로고침 시 적용됩니다.");
                                location.reload();
                            } else {
                                alert("되돌리기 실패: " + result.error);
                            }
                        } catch (e) {
                            alert("서버 연결 실패");
                        }
                    };

                    slot.appendChild(btn);
                });
            }
        });

    } catch (err) {
        console.error("Wiki history error:", err);
        overlay.innerHTML = `
            <div class="list-modal fade-in wiki-modal" style="text-align: center;">
                <div class="wiki-modal-header">
                    <h2>수정 역사 기록</h2>
                    <button class="wiki-close-btn" id="close-${modalId}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="color:#f87171;">기록을 불러오는데 실패했습니다.</p>
                </div>
            </div>
        `;
        const closeBtn = document.getElementById(`close-${modalId}`);
        if (closeBtn) closeBtn.onclick = () => overlay.remove();
    }
};
