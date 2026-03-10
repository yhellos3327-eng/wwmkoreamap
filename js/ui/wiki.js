// @ts-check
import { state } from "../state.js";
import { BACKEND_URL } from "../config.js";
import { getAuthToken, isLoggedIn, getAuthHeaders } from "../auth.js";
import { t, parseMarkdown, getUserLevelIcon, maskIdentifier } from "../utils.js";

/**
 * Opens a modal to propose edits for a marker
 * @param {string|number} itemId
 * @param {boolean} isOfficial
 */
export const openWikiEditModal = async (itemId, isOfficial) => {
    /* 
    if (!isLoggedIn()) {
        alert("위키 문서 수정을 제안하려면 먼저 로그인해야 합니다.");
        const authBtn = document.getElementById("auth-btn");
        if (authBtn) authBtn.click();
        return;
    }
    */

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
                <h2>위키 편집</h2>
                <button class="wiki-close-btn" id="close-${modalId}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="wiki-info-text">
                    이 마커(<strong style="color:var(--accent)">${currentTitle}</strong>)의 정보를 자유롭게 수정해주세요.
                    수정 내용은 <strong>실시간으로 지도에 반영</strong>됩니다.
                    ${!isLoggedIn() ? '<br><span style="color:#ff6b6b; font-size:0.85em;">(비로그인 상태입니다. IP/핑거프린트가 기록됩니다.)</span>' : ''}
                </p>
                <form id="wiki-form-${itemId}">
                    <div class="wiki-form-group">
                        <label>제목</label>
                        <input type="text" id="wiki-title-${itemId}" class="wiki-input" value="${currentTitle}" placeholder="마커 이름">
                    </div>
                    
                    <div class="wiki-form-group">
                        <label>지역 명</label>
                        <input type="text" id="wiki-region-${itemId}" class="wiki-input" value="${targetItem.region || ''}" placeholder="예: 청하, 금주 등">
                    </div>
                    
                    <div class="wiki-form-group">
                        <label>설명 (마크다운 지원) 및 미리보기</label>
                        <div class="wiki-editor-container">
                            <textarea id="wiki-desc-${itemId}" class="wiki-textarea wiki-editor-textarea" placeholder="자세한 위치나 팁을 적어주세요.">${currentDesc}</textarea>
                            <div id="wiki-preview-${itemId}" class="wiki-preview-content markdown-body"></div>
                        </div>
                    </div>

                    <div class="wiki-form-group">
                        <label>이미지 첨부 방식</label>
                        <div class="wiki-image-options" style="display: flex; gap: 16px; margin-bottom: 8px;">
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: normal; cursor: pointer;">
                                <input type="radio" name="wiki-img-type-${itemId}" value="slide" checked>
                                슬라이드형 (썸네일)
                            </label>
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: normal; cursor: pointer;">
                                <input type="radio" name="wiki-img-type-${itemId}" value="inline">
                                본문 삽입형
                            </label>
                        </div>
                        
                        <div id="wiki-img-slide-container-${itemId}" style="display: block;">
                            <input type="file" id="wiki-img-${itemId}" class="wiki-file-input" accept="image/jpeg, image/png, image/webp">
                            <small style="color: #888; display: block; margin-top: 4px;">게시글 상단에 슬라이드 형태로 단일 이미지가 추가됩니다.</small>
                        </div>
                        
                        <div id="wiki-img-inline-container-${itemId}" style="display: none;">
                            <button type="button" id="wiki-insert-img-${itemId}" class="wiki-toolbar-btn" title="본문에 이미지 삽입">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                본문에 이미지 업로드 및 삽입
                            </button>
                            <input type="file" id="wiki-inline-img-file-${itemId}" accept="image/jpeg, image/png, image/webp" style="display: none;">
                            <small style="color: #888; display: block; margin-top: 4px;">업로드 시 본문에 마크다운 형태( ![이미지](${BACKEND_URL}/...) )로 삽입됩니다.</small>
                        </div>
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
                        <span>저장하기</span>
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

    // Add Delete Button to the bottom of the form
    const wikiForm = document.getElementById(`wiki-form-${itemId}`);
    if (wikiForm) {
        const deleteBtnContainer = document.createElement("div");
        deleteBtnContainer.style.marginTop = "16px";
        deleteBtnContainer.style.display = "flex";
        deleteBtnContainer.style.justifyContent = "center";
        deleteBtnContainer.innerHTML = `
            <button type="button" id="wiki-delete-提案-${itemId}" class="wiki-delete-btn" style="background: rgba(255, 0, 0, 0.1); color: #ff6b6b; border: 1px solid rgba(255, 0, 0, 0.2); padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                이 마커 삭제 제안
            </button>
        `;
        wikiForm.appendChild(deleteBtnContainer);

        const deleteProposalBtn = document.getElementById(`wiki-delete-提案-${itemId}`);
        if (deleteProposalBtn) {
            deleteProposalBtn.onclick = async () => {
                const reason = prompt("이 마커를 삭제해야 하는 이유를 입력해주세요:");
                if (!reason || !reason.trim()) return;

                if (!confirm("정말 이 마커의 삭제를 제안하시겠습니까?")) return;

                try {
                    const token = await getAuthToken();
                    const formData = new FormData();
                    formData.append('target_marker_id', String(itemId));
                    formData.append('is_official', String(isOfficial));
                    formData.append('map_id', state.currentMapKey || 'qinghe');
                    formData.append('deleted', 'true');
                    formData.append('edit_reason', reason.trim());
                    // Force pending for deletions usually, unless highly trusted
                    formData.append('status', 'pending');

                    const response = await fetch(`${BACKEND_URL}/api/revisions`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });

                    const data = await response.json();
                    if (data.success) {
                        alert("삭제 제안이 제출되었습니다. 관리자 검토 후 반영됩니다.");
                        overlay.remove();
                    } else {
                        alert("제출 실패: " + (data.error || "알 수 없는 오류"));
                    }
                } catch (err) {
                    console.error("Delete proposal error:", err);
                    alert("서버 연결 실패");
                }
            };
        }
    }

    if (textDescEl && previewEl) {
        const updatePreview = () => {
            previewEl.innerHTML = parseMarkdown((/** @type {HTMLTextAreaElement} */ (textDescEl)).value);
        };
        textDescEl.addEventListener('input', updatePreview);
        updatePreview(); // Initial render

        // Image Type Selection Logic
        const slideContainer = document.getElementById(`wiki-img-slide-container-${itemId}`);
        const inlineContainer = document.getElementById(`wiki-img-inline-container-${itemId}`);
        const typeRadios = document.querySelectorAll(`input[name="wiki-img-type-${itemId}"]`);

        typeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (/** @type {HTMLInputElement} */(e.target).value === 'slide') {
                    if (slideContainer) slideContainer.style.display = 'block';
                    if (inlineContainer) inlineContainer.style.display = 'none';
                } else {
                    if (slideContainer) slideContainer.style.display = 'none';
                    if (inlineContainer) inlineContainer.style.display = 'block';
                }
            });
        });

        // Inline Image Upload Logic
        const insertImgBtn = document.getElementById(`wiki-insert-img-${itemId}`);
        const inlineImgFile = document.getElementById(`wiki-inline-img-file-${itemId}`);

        if (insertImgBtn && inlineImgFile) {
            insertImgBtn.onclick = () => inlineImgFile.click();

            inlineImgFile.onchange = async (e) => {
                const file = /** @type {HTMLInputElement} */(e.target).files?.[0];
                if (!file) return;

                const originalText = insertImgBtn.innerHTML;
                insertImgBtn.innerHTML = "업로드 중...";
                // @ts-ignore
                insertImgBtn.disabled = true;

                try {
                    const token = await getAuthToken();
                    const formData = new FormData();
                    formData.append('image', file);
                    // @ts-ignore
                    if (window.visitorId) {
                        // @ts-ignore
                        formData.append('fingerprint', window.visitorId);
                    }

                    /** @type {RequestInit} */
                    const fetchOptions = {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    };

                    if (token) {
                        fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
                    }

                    const res = await fetch(`${BACKEND_URL}/api/revisions/upload`, fetchOptions);

                    const data = await res.json();
                    if (data.success && data.url) {
                        const imgMarkdown = `\n![이미지](${data.url})\n`;
                        const textarea = /** @type {HTMLTextAreaElement} */(textDescEl);
                        const startObj = textarea.selectionStart;
                        const endObj = textarea.selectionEnd;

                        textarea.value = textarea.value.substring(0, startObj) + imgMarkdown + textarea.value.substring(endObj, textarea.value.length);

                        // Move cursor after the inserted markdown
                        textarea.selectionStart = textarea.selectionEnd = startObj + imgMarkdown.length;
                        textarea.focus();
                        updatePreview();
                    } else {
                        alert("이미지 업로드 실패: " + (data.error || "알 수 없는 오류"));
                    }
                } catch (err) {
                    console.error("Inline image upload error:", err);
                    alert("업로드 중 인터넷 연결 오류가 발생했습니다.");
                } finally {
                    insertImgBtn.innerHTML = originalText;
                    // @ts-ignore
                    insertImgBtn.disabled = false;
                    // @ts-ignore
                    inlineImgFile.value = "";
                }
            };
        }
    }

    const form = document.getElementById(`wiki-form-${itemId}`);
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const titleEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-title-${itemId}`));
            const regionEl = /** @type {HTMLInputElement} */ (document.getElementById(`wiki-region-${itemId}`));
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
                formData.append('map_id', state.currentMapKey || 'qinghe');
                formData.append('title', titleEl.value.trim());
                formData.append('region_name', regionEl.value.trim());
                formData.append('description', descEl.value.trim());
                formData.append('video', videoEl.value.trim());
                formData.append('edit_reason', reasonEl.value.trim());
                formData.append('auto_approve', 'true');
                formData.append('status', 'approved');
                formData.append('approve', 'true');
                formData.append('skip_review', 'true');
                formData.append('immediate', 'true');
                formData.append('is_official', String(isOfficial));
                // @ts-ignore
                if (window.visitorId) {
                    // @ts-ignore
                    formData.append('fingerprint', window.visitorId);
                }

                if (imgEl.files && imgEl.files.length > 0) {
                    formData.append('screenshot', imgEl.files[0]);
                }

                /** @type {RequestInit} */
                const fetchOptions = {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                };

                if (token) {
                    fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
                }

                const res = await fetch(`${BACKEND_URL}/api/revisions`, fetchOptions);

                const data = await res.json();
                if (data.success) {
                    alert("수정 완료! 변경된 내용이 지도에 즉시 반영되었습니다.");
                    overlay.remove();
                    // 페이지 새로고침 없이 마커 정보 갱신을 위해 location.reload() 호출 (또는 상태 업데이트 로직 추가 가능)
                    setTimeout(() => location.reload(), 500);
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
        const res = await fetch(`${BACKEND_URL}/api/revisions/target/${itemId}`, {
            credentials: 'include'
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        let listHtml = "";
        if (data.history && data.history.length > 0) {
            listHtml = data.history.map((rev, index) => {
                const date = new Date(rev.created_at).toLocaleString('ko-KR');
                const stateColor =
                    rev.status === 'approved' ? 'color: #4ade80;' : // green
                        rev.status === 'rejected' ? 'color: #f87171;' : // red
                            rev.status === 'reverted' ? 'color: #9ca3af;' : // gray
                                'color: #fbbf24;'; // yellow pending

                const stateText =
                    rev.status === 'approved' ? '승인' :
                        rev.status === 'rejected' ? '반려' :
                            rev.status === 'reverted' ? '되돌려짐' :
                                '검토중';

                const isAdmin = rev.user_level === 4 || rev.is_admin;
                const safeName = isAdmin ? "관리자" : (rev.display_name || (rev.user_id ? `User#${rev.user_id}` : "익명"));
                const levelIcon = getUserLevelIcon(rev.user_level);
                const maskedIp = rev.ip_address ? maskIdentifier(rev.ip_address, 'ip') : null;
                const maskedFp = rev.fingerprint ? maskIdentifier(rev.fingerprint, 'fp') : null;
                const identifier = (isAdmin || !maskedIp && !maskedFp) ? '' : (maskedIp ? ` (IP: ${maskedIp})` : ` (FP: ${maskedFp})`);

                const adminCheckbox = `<input type="checkbox" class="wiki-history-select" data-rev-id="${rev.id}" style="margin-right: 15px; cursor: pointer; transform: scale(1.2);">`;

                return `
                    <div class="wiki-history-item" data-rev-id="${rev.id}">
                        <div class="admin-select-slot" style="display:none; align-items: center;">${adminCheckbox}</div>
                        <div class="wiki-history-header">
                            <span class="wiki-history-date">${date}</span>
                            <span class="wiki-history-status" style="${stateColor}">${stateText}</span>
                        </div>
                        <div class="wiki-history-contributor">
                            기여자: <span style="color: var(--accent); display: inline-flex; align-items: center;">${levelIcon}${safeName}${identifier}</span>
                        </div>
                        <div class="wiki-history-reason">
                            사유: ${rev.edit_reason || "사유 없음"}
                        </div>
                        <div class="wiki-history-changes">
                            ${rev.is_creation ? '<span class="wiki-tag" style="background:rgba(74,222,128,0.2); color:#4ade80;">신규 추가</span>' : ''}
                            ${rev.revision_data.deleted ? '<span class="wiki-tag" style="background:rgba(248,113,113,0.2); color:#f87171;">삭제 제안</span>' : ''}
                            ${(rev.revision_data.lat !== undefined || rev.revision_data.lng !== undefined) ? '<span class="wiki-tag" style="background:rgba(96,165,250,0.2); color:#60a5fa;">위치 이동</span>' : ''}
                            ${rev.revision_data.title && !rev.is_creation ? `<span class="wiki-tag">제목</span> ` : ''}
                            ${rev.revision_data.region_name ? `<span class="wiki-tag">지역</span> ` : ''}
                            ${rev.revision_data.description ? `<span class="wiki-tag">설명</span> ` : ''}
                            ${rev.revision_data.video ? `<span class="wiki-tag">영상</span> ` : ''}
                            ${rev.revision_data.screenshot ? `<span class="wiki-tag">이미지(슬라이드)</span> ` : ''}
                            <button class="wiki-history-view-btn" data-rev-index="${index}">내용 보기</button>
                        </div>
                        
                        <div id="wiki-rev-detail-${index}" class="wiki-history-detail" style="display: none;">
                            ${rev.revision_data.title ? `<div class="wiki-detail-field"><strong>제목:</strong> ${rev.revision_data.title}</div>` : ''}
                            ${rev.revision_data.region_name ? `<div class="wiki-detail-field"><strong>지역 명:</strong> ${rev.revision_data.region_name}</div>` : ''}
                            ${rev.revision_data.description ? `<div class="wiki-detail-field"><strong>설명:</strong> <div class="wiki-detail-md">${parseMarkdown(rev.revision_data.description)}</div></div>` : ''}
                            ${rev.revision_data.video ? `<div class="wiki-detail-field"><strong>영상:</strong> <a href="${rev.revision_data.video}" target="_blank">${rev.revision_data.video}</a></div>` : ''}
                            ${rev.revision_data.screenshot ? `<div class="wiki-detail-field"><strong>이미지:</strong> <img src="${rev.revision_data.screenshot}" style="max-width: 100%; border-radius: 4px; margin-top: 4px;"></div>` : ''}
                        </div>
                        ${rev.status === 'pending' ? `
                            <div class="wiki-history-actions">
                                <div class="wiki-history-votes">
                                     <button type="button" class="wiki-vote-badge wiki-vote-up wiki-history-vote-btn" data-rev-id="${rev.id}" data-type="up">
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                         추천 <span class="vote-count">${rev.votes}</span>/5
                                     </button>
                                     <button type="button" class="wiki-vote-badge wiki-vote-down wiki-history-vote-btn" data-rev-id="${rev.id}" data-type="report">
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg>
                                         신고 <span class="report-count">${rev.reports}</span>/3
                                     </button>
                                </div>
                                <div class="wiki-approval-controls" data-rev-id="${rev.id}" data-is-official="${rev.is_official}" data-rev-data='${JSON.stringify(rev.revision_data).replace(/'/g, "&apos;")}' data-author-id="${rev.user_id || ''}">
                                    <!-- Slots for Approve/Reject buttons -->
                                </div>
                            </div>
                        ` : ''}
                        <div class="admin-rollback-slot" data-rev-id="${rev.id}" data-user-id="${rev.user_id}" data-ip="${rev.ip_address || ''}" data-fp="${rev.fingerprint || ''}"></div>
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
                <div class="wiki-admin-bulk-actions" style="display:none; padding: 10px 20px; background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1); align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="wiki-history-select-all" style="margin-right: 10px; cursor: pointer;">
                        <label for="wiki-history-select-all" style="font-size: 0.9em; cursor: pointer;">전체 선택</label>
                    </div>
                    <button class="action-btn-small" id="wiki-history-bulk-delete" style="background: rgba(255, 0, 0, 0.2); color: #ff6b6b; border: 1px solid rgba(255, 0, 0, 0.3);">선택 삭제</button>
                </div>
                <div class="wiki-history-body">
                    ${listHtml}
                </div>
            </div>
        `;

        overlay.innerHTML = modalHtml;

        const closeBtn = document.getElementById(`close-${modalId}`);
        if (closeBtn) closeBtn.onclick = () => overlay.remove();

        // Toggle Detail Logic
        overlay.querySelectorAll('.wiki-history-view-btn').forEach(btn => {
            (/** @type {HTMLElement} */(btn)).onclick = (e) => {
                const index = /** @type {HTMLElement} */(e.target).dataset.revIndex;
                const detail = document.getElementById(`wiki-rev-detail-${index}`);
                if (detail) {
                    const isHidden = detail.style.display === 'none';
                    detail.style.display = isHidden ? 'block' : 'none';
                    /** @type {HTMLElement} */(e.target).textContent = isHidden ? '닫기' : '내용 보기';
                }
            };
        });

        // Revision Vote Logic
        overlay.querySelectorAll('.wiki-history-vote-btn').forEach(btn => {
            (/** @type {HTMLElement} */(btn)).onclick = async (e) => {
                const button = /** @type {HTMLElement} */(e.currentTarget);
                const revId = button.dataset.revId;
                const voteType = button.dataset.type;

                try {
                    const { getAuthToken, isLoggedIn } = await import("../auth.js");
                    if (!isLoggedIn()) {
                        alert("투표하려면 로그인이 필요합니다.");
                        return;
                    }

                    const token = await getAuthToken();
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}/vote`, {
                        method: 'POST',
                        headers: await getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({ type: voteType })
                    });

                    const result = await res.json();
                    if (result.success) {
                        alert(voteType === 'up' ? "추천되었습니다!" : "신고되었습니다!");
                        // Optional: update the count locally if we want to be fancy, 
                        // but re-opening or just alerting is standard for this scope.
                    } else {
                        alert("투표 실패: " + (result.error || "권한이 없거나 이미 투표했을 수 있습니다."));
                    }
                } catch (err) {
                    console.error("Revision vote error:", err);
                    alert("투표 중 오류가 발생했습니다.");
                }
            };
        });

        // Inject Admin/Expert/Logged-in buttons if authorized
        import("../auth.js").then(({ isAdminUser, canRevert, getAuthToken, getCurrentUser }) => {
            const isAdmin = isAdminUser();
            const allowedToRevert = canRevert();
            const user = getCurrentUser();
            const userLevel = user?.level || 0;

            // Tiered Approval Controls Injection
            overlay.querySelectorAll('.wiki-approval-controls').forEach(container => {
                const slot = /** @type {HTMLElement} */(container);
                const revId = slot.dataset.revId;
                const authorId = slot.dataset.authorId;
                const isOfficial = String(slot.dataset.isOfficial) === '1';
                /** @type {any} */
                let revData = {};
                try { revData = JSON.parse(slot.dataset.revData || '{}'); } catch (e) { }

                // Determine required level
                let requiredLevel = 4; // Admin
                if (!isOfficial) {
                    if (revData.deleted) requiredLevel = 3;
                    else if (revData.lat !== undefined) requiredLevel = 2;
                    else if (!authorId) requiredLevel = 1;
                    else requiredLevel = 2; // Default community content
                }

                const isSelf = authorId && user && String(authorId) === String(user.id);
                const hasPermission = isAdmin || (userLevel >= requiredLevel && !isSelf);

                if (hasPermission) {
                    const approveBtn = document.createElement("button");
                    approveBtn.className = "wiki-history-approve-btn";
                    approveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>승인`;
                    approveBtn.onclick = async () => {
                        if (!confirm("이 제안을 승인하시겠습니까?")) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}/approve`, {
                                method: 'POST',
                                headers: await getAuthHeaders(),
                                credentials: 'include'
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("승인되었습니다.");
                                overlay.remove();
                                openWikiHistoryModal(itemId);
                            } else {
                                alert(result.message || "승인 실패");
                            }
                        } catch (e) { alert("연결 실패"); }
                    };

                    const rejectBtn = document.createElement("button");
                    rejectBtn.className = "wiki-history-reject-btn";
                    rejectBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>반려`;
                    rejectBtn.onclick = async () => {
                        if (!confirm("이 제안을 반려하시겠습니까?")) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}/reject`, {
                                method: 'POST',
                                headers: await getAuthHeaders(),
                                credentials: 'include'
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("반려되었습니다.");
                                overlay.remove();
                                openWikiHistoryModal(itemId);
                            } else {
                                alert(result.message || "반려 실패");
                            }
                        } catch (e) { alert("연결 실패"); }
                    };

                    slot.appendChild(approveBtn);
                    slot.appendChild(rejectBtn);
                }
            });

            if (isAdmin || allowedToRevert) {
                overlay.querySelectorAll('.admin-rollback-slot').forEach(slot => {
                    const revId = /** @type {HTMLElement} */(slot).dataset.revId;
                    const uId = /** @type {HTMLElement} */(slot).dataset.userId;
                    const ip = /** @type {HTMLElement} */(slot).dataset.ip;
                    const fp = /** @type {HTMLElement} */(slot).dataset.fp;

                    // Revert Button
                    const revertBtn = document.createElement("button");
                    revertBtn.className = "action-btn-small wiki-admin-revert-btn";
                    revertBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>되돌리기`;
                    revertBtn.style.marginRight = "5px";

                    revertBtn.onclick = async () => {
                        if (!confirm(`정말 이 리비전(#${revId}) 상태로 마커를 완전히 되돌리시겠습니까?`)) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}/revert`, {
                                method: 'POST',
                                headers: await getAuthHeaders(),
                                credentials: 'include'
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("성공적으로 되돌렸습니다.");
                                location.reload();
                            } else {
                                alert("되돌리기 실패: " + result.error);
                            }
                        } catch (e) { alert("서버 연결 실패"); }
                    };

                    slot.appendChild(revertBtn);

                    // Only Admins can Ban or Delete
                    if (!isAdmin) return;

                    // Ban Button
                    const banBtn = document.createElement("button");
                    banBtn.className = "action-btn-small";
                    banBtn.style.background = "rgba(255, 165, 0, 0.2)";
                    banBtn.style.color = "#fbbf24";
                    banBtn.style.border = "1px solid rgba(255, 165, 0, 0.3)";
                    banBtn.style.marginRight = "5px";
                    banBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>차단 (Ban)`;

                    banBtn.onclick = async () => {
                        const reason = prompt("이 사용자를 차단하는 이유를 적어주세요:");
                        if (reason === null) return;

                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/admin/ban`, {
                                method: 'POST',
                                headers: await getAuthHeaders(),
                                credentials: 'include',
                                body: JSON.stringify({
                                    target_user_id: uId,
                                    target_ip: ip,
                                    target_fingerprint: fp,
                                    reason: reason
                                })
                            });
                            const result = await res.json();
                            if (result.success) alert("사용자가 차단되었습니다.");
                            else alert("차단 실패: " + result.error);
                        } catch (e) { alert("서버 연결 실패"); }
                    };

                    // Delete Button
                    const deleteBtn = document.createElement("button");
                    deleteBtn.className = "action-btn-small";
                    deleteBtn.style.background = "rgba(255, 0, 0, 0.2)";
                    deleteBtn.style.color = "#ff6b6b";
                    deleteBtn.style.border = "1px solid rgba(255, 0, 0, 0.3)";
                    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>삭제 (Admin)`;

                    deleteBtn.onclick = async () => {
                        if (!confirm(`이 편집 기록(#${revId})을 영구 삭제하시겠습니까?`)) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}`, {
                                method: 'DELETE',
                                headers: await getAuthHeaders(),
                                credentials: 'include'
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("삭제되었습니다.");
                                overlay.remove();
                                openWikiHistoryModal(itemId);
                            } else {
                                alert("삭제 실패: " + result.error);
                            }
                        } catch (e) { alert("서버 연결 실패"); }
                    };

                    slot.appendChild(revertBtn);
                    slot.appendChild(banBtn);
                    slot.appendChild(deleteBtn);
                });

                // Only Admins see Bulk Actions and Checkboxes
                if (isAdmin) {
                    // Show admin selection UI
                    overlay.querySelectorAll('.admin-select-slot').forEach(el => (/** @type {HTMLElement} */(el)).style.display = 'flex');
                    const bulkActions = /** @type {HTMLElement} */(overlay.querySelector('.wiki-admin-bulk-actions'));
                    if (bulkActions) bulkActions.style.display = 'flex';

                    // Select All Logic
                    const selectAllImg = /** @type {HTMLInputElement} */(overlay.querySelector('#wiki-history-select-all'));
                    const individualCbs = overlay.querySelectorAll('.wiki-history-select');

                    if (selectAllImg) {
                        /** @type {any} */(selectAllImg).onchange = (e) => {
                            const checked = (/** @type {HTMLInputElement} */(e.target)).checked;
                            individualCbs.forEach(cb => {
                                (/** @type {HTMLInputElement} */(cb)).checked = checked;
                                if (checked) cb.closest('.wiki-history-item').classList.add('selected');
                                else cb.closest('.wiki-history-item').classList.remove('selected');
                            });
                        };
                    }

                    individualCbs.forEach(cb => {
                        /** @type {any} */(cb).onchange = (e) => {
                            const allChecked = Array.from(individualCbs).every(c => (/** @type {HTMLInputElement} */(c)).checked);
                            if (selectAllImg) selectAllImg.checked = allChecked;

                            if ((/** @type {HTMLInputElement} */(e.target)).checked) cb.closest('.wiki-history-item').classList.add('selected');
                            else cb.closest('.wiki-history-item').classList.remove('selected');
                        };
                    });

                    // Bulk Delete Logic
                    const bulkDeleteBtn = overlay.querySelector('#wiki-history-bulk-delete');
                    if (bulkDeleteBtn) {
                        (/** @type {HTMLElement} */(bulkDeleteBtn)).onclick = async () => {
                            const selectedCbs = overlay.querySelectorAll('.wiki-history-select:checked');
                            if (selectedCbs.length === 0) {
                                alert("삭제할 항목을 선택해주세요.");
                                return;
                            }

                            if (!confirm(`선택한 ${selectedCbs.length}개의 편집 기록을 영구 삭제하시겠습니까?`)) return;

                            const token = await getAuthToken();
                            let successCount = 0;
                            let failCount = 0;

                            for (const cb of selectedCbs) {
                                const revId = (/** @type {HTMLInputElement} */(cb)).dataset.revId;
                                try {
                                    const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    const result = await res.json();
                                    if (result.success) successCount++;
                                    else failCount++;
                                } catch (e) { failCount++; }
                            }

                            alert(`${successCount}개 삭제 완료` + (failCount > 0 ? `, ${failCount}개 실패` : ""));
                            overlay.remove();
                            openWikiHistoryModal(itemId);
                        };
                    }
                }
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

/**
 * Renders the global wiki history in the sidebar tab
 * @param {HTMLElement} container
 */
export const renderGlobalWikiHistory = async (container) => {
    container.innerHTML = `<p class="empty-msg">로딩 중...</p>`;

    try {
        const res = await fetch(`${BACKEND_URL}/api/revisions`);
        const data = await res.json();

        if (!data.success || !data.revisions) {
            container.innerHTML = `<p class="empty-msg">기록을 불러오지 못했습니다.</p>`;
            return;
        }

        if (data.revisions.length === 0) {
            container.innerHTML = `<p class="empty-msg">기록이 없습니다.</p>`;
            return;
        }

        container.innerHTML = data.revisions.map((rev, index) => {
            const date = new Date(rev.created_at).toLocaleDateString('ko-KR');
            const safeName = rev.display_name || `User#${rev.user_id}`;
            const markerName = rev.revision_data.title || `마커 #${rev.target_marker_id}`;

            const stateText =
                rev.status === 'approved' ? '승인' :
                    rev.status === 'rejected' ? '반려' :
                        rev.status === 'reverted' ? '되돌림' : '반영'; // '대기' 대신 '반영'

            const stateClass = `wiki-status-${rev.status}`;

            return `
                <div class="favorite-item wiki-global-item" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; width: 100%; font-size: 11px; opacity: 0.8;">
                        <span>${date}</span>
                        <div style="display: flex; gap: 4px;">
                            ${rev.is_creation ? '<span style="background:rgba(74,222,128,0.2); color:#4ade80; font-size: 10px; padding: 2px 4px; border-radius: 3px;">신규</span>' : ''}
                            ${rev.revision_data.deleted ? '<span style="background:rgba(248,113,113,0.2); color:#f87171; font-size: 10px; padding: 2px 4px; border-radius: 3px;">삭제</span>' : ''}
                            ${(rev.revision_data.lat !== undefined || rev.revision_data.lng !== undefined) ? '<span style="background:rgba(96,165,250,0.2); color:#60a5fa; font-size: 10px; padding: 2px 4px; border-radius: 3px;">이동</span>' : ''}
                            <span class="wiki-history-status ${stateClass}" style="font-size: 10px; padding: 2px 4px; border-radius: 3px;">${stateText}</span>
                        </div>
                    </div>
                    <div style="font-weight: bold; font-size: 13px; color: var(--accent); cursor: pointer;" class="wiki-global-target" data-marker-id="${rev.target_marker_id}">
                        ${markerName}
                    </div>
                    <div style="font-size: 11px; opacity: 0.9;">
                        기여자: ${safeName}
                    </div>
                    <div style="font-size: 10px; font-style: italic; margin-top: 4px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">
                        "${rev.edit_reason || '사유 없음'}"
                    </div>
                    <div style="display: flex; gap: 5px; width: 100%; margin-top: 8px;">
                        <button class="action-btn-small wiki-global-jump-btn" style="flex: 1;" data-marker-id="${rev.target_marker_id}" data-map-id="${rev.map_id || 'qinghe'}" title="마커 위치로 이동">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            위치
                        </button>
                        <button class="action-btn-small wiki-global-view-btn" style="flex: 1;" data-marker-id="${rev.target_marker_id}">
                            기록
                        </button>
                        <div class="admin-delete-slot" data-rev-id="${rev.id}" data-is-creation="${rev.is_creation}"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        container.querySelectorAll('.wiki-global-target, .wiki-global-view-btn').forEach(el => {
            (/** @type {HTMLElement} */(el)).onclick = (e) => {
                const markerId = /** @type {HTMLElement} */(e.currentTarget).dataset.markerId;
                if (markerId) openWikiHistoryModal(markerId);
            };
        });

        // Jump to marker location (with cross-map auto-search)
        container.querySelectorAll('.wiki-global-jump-btn').forEach(el => {
            (/** @type {HTMLElement} */(el)).onclick = async (e) => {
                e.stopPropagation();
                const btn = /** @type {HTMLElement} */(e.currentTarget);
                const markerId = btn.dataset.markerId;
                const revMapId = btn.dataset.mapId;
                if (!markerId) return;

                const { loadMapData } = await import("../data/loader.js");
                const { setState } = await import("../state.js");
                const { MAP_CONFIGS } = await import("../config.js");
                const { findItem } = await import("./navigation.js");

                const tryMap = async (mapKey) => {
                    if (state.currentMapKey !== mapKey) {
                        setState("currentMapKey", mapKey);
                        await loadMapData(mapKey);
                    }
                    return state.mapData?.items?.some(i => String(i.id) === String(markerId));
                };

                // 1) Try revision's map_id first, then current map
                const firstTry = (revMapId && revMapId !== 'qinghe') ? revMapId : state.currentMapKey;
                if (await tryMap(firstTry)) { findItem(markerId); return; }

                // 2) Search remaining maps
                for (const key of Object.keys(MAP_CONFIGS)) {
                    if (key === firstTry) continue;
                    if (await tryMap(key)) { findItem(markerId); return; }
                }

                const { showSyncToast } = await import("../sync/ui.js");
                showSyncToast("해당 마커를 찾을 수 없습니다.", "error");
            };
        });

        // Admin Delete Button for global feed
        import("../auth.js").then(({ isAdminUser, getAuthToken }) => {
            if (isAdminUser()) {
                container.querySelectorAll('.admin-delete-slot').forEach(slot => {
                    const revId = /** @type {HTMLElement} */(slot).dataset.revId;
                    const isCreation = /** @type {HTMLElement} */(slot).dataset.isCreation === '1';
                    if (isCreation) return; // Cannot delete initial creation 'history' only - it's tied to the marker
                    const btn = document.createElement("button");
                    btn.className = "action-btn-small";
                    btn.style.background = "rgba(255, 0, 0, 0.2)";
                    btn.style.color = "#ff6b6b";
                    btn.style.border = "1px solid rgba(255, 0, 0, 0.3)";
                    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (!confirm(`이 편집 기록(#${revId})을 삭제하시겠습니까?`)) return;
                        try {
                            const token = await getAuthToken();
                            const res = await fetch(`${BACKEND_URL}/api/revisions/${revId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const result = await res.json();
                            if (result.success) {
                                alert("삭제되었습니다.");
                                renderGlobalWikiHistory(container); // Refresh sidebar
                            } else {
                                alert("삭제 실패: " + result.error);
                            }
                        } catch (e) { alert("서버 연결 실패"); }
                    };
                    slot.appendChild(btn);
                });
            }
        });

    } catch (err) {
        console.error("Global wiki history error:", err);
        container.innerHTML = `<p class="empty-msg">서버 연결 오류</p>`;
    }
};

