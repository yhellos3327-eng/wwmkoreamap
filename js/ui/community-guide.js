// @ts-check
import { BACKEND_URL } from "../config.js";

/**
 * Show the Community Mode Guide
 */
export const showCommunityGuide = () => {
    const guideId = 'community-mode-guide';
    if (document.getElementById(guideId)) return;

    // Check if user has already seen the guide
    if (localStorage.getItem('hideCommunityGuide') === 'true') return;

    const overlay = document.createElement("div");
    overlay.id = guideId;
    overlay.className = "modal-overlay active";
    overlay.style.zIndex = "20000";
    overlay.style.backdropFilter = "blur(10px)";

    overlay.innerHTML = `
        <div class="list-modal fade-in" style="max-width: 500px; padding: 30px; border: 1px solid rgba(218, 172, 113, 0.3); background: rgba(15, 15, 15, 0.95); box-shadow: 0 20px 50px rgba(0,0,0,0.5); border-radius: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 60px; height: 60px; background: rgba(218, 172, 113, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: var(--primary);">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <h2 style="margin: 0; color: var(--primary); font-size: 24px;">커뮤니티 모드 가이드</h2>
                <p style="color: #888; margin-top: 8px; font-size: 14px;">지도를 함께 만들어가는 방법을 알아보세요.</p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
                <div style="display: flex; gap: 16px;">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; background: rgba(74, 222, 128, 0.1); color: #4ade80; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</div>
                    <div>
                        <h4 style="margin: 0 0 4px; color: #eee;">마커 추가</h4>
                        <p style="margin: 0; font-size: 13px; color: #aaa;">맵의 빈 곳을 <strong>휠 클릭</strong>하여 새로운 마커를 제보할 수 있습니다.</p>
                    </div>
                </div>

                <div style="display: flex; gap: 16px;">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; background: rgba(96, 165, 250, 0.1); color: #60a5fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold;">2</div>
                    <div>
                        <h4 style="margin: 0 0 4px; color: #eee;">정보 수정 및 삭제 제안</h4>
                        <p style="margin: 0; font-size: 13px; color: #aaa;">마커를 클릭한 후 <strong>'수정' 아이콘</strong>을 눌러 이름, 설명 등을 변경하거나 삭제를 요청하세요.</p>
                    </div>
                </div>

                <div style="display: flex; gap: 16px;">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; background: rgba(251, 191, 36, 0.1); color: #fbbf24; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold;">3</div>
                    <div>
                        <h4 style="margin: 0 0 4px; color: #eee;">마커 위치 이동</h4>
                        <p style="margin: 0; font-size: 13px; color: #aaa;">도구함의 <strong>'마커 이동'</strong> 기능을 켠 상태로 마커 선택 후 새 위치를 클릭하여 이동을 제안하세요.</p>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="close-guide-btn" class="wiki-submit-btn" style="width: 100%; justify-content: center; height: 45px; font-size: 16px;">
                    확인했습니다
                </button>
                <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-size: 12px; color: #666;">
                    <input type="checkbox" id="hide-guide-checkbox"> 다시 보지 않기
                </label>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('close-guide-btn');
    const hideCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('hide-guide-checkbox'));

    if (closeBtn) {
        closeBtn.onclick = () => {
            if (hideCheckbox && hideCheckbox.checked) {
                localStorage.setItem('hideCommunityGuide', 'true');
            }
            overlay.remove();
        };
    }
};
