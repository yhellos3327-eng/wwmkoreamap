const NOTICE_ID = '2025-12-20-domain-change-v2';

/**
 * Initialize and display the main notice modal when the user has not previously dismissed it.
 *
 * Checks persistent storage for the user's "don't show again" setting for this notice and,
 * if that setting is not `'true'`, renders the notice modal.
 */
export async function initMainNotice() {
    const { primaryDb } = await import("./storage/db.js");
    const dontShowAgain = await primaryDb.get(`notice_hidden_${NOTICE_ID}`);

    if (dontShowAgain === 'true') {
        return;
    }

    createNoticeModal();
}

/**
 * Render and attach the main domain-change notice modal to the document if one does not already exist.
 *
 * Inserts an overlay modal that informs users about the upcoming domain and tech-stack change, wires controls to close the modal, and provides a path to the settings backup section. The modal's close buttons and overlay click will dismiss the modal; the "지금 백업하러 가기" action also opens settings and scrolls/highlights the backup section. The modal includes a "다시 보지 않기" checkbox whose state is persisted when the modal is closed.
 */
function createNoticeModal() {
    if (document.getElementById('main-notice-overlay')) return;

    const modalHtml = `
        <div id="main-notice-overlay" class="main-notice-overlay">
            <div class="main-notice-content">
                <div class="main-notice-header">
                    <h2 class="main-notice-title">📢 도메인 변경 및 기술 스택 업그레이드 안내</h2>
                    <button class="main-notice-close-btn" id="btn-close-notice">&times;</button>
                </div>
                <div class="main-notice-body">
                    <h3>안녕하세요, 연운 한국어 맵입니다.</h3>
                    <p>
                        단순히 주소가 길어서 바꾸는 것이 아닙니다. 현재의 정적 페이지 방식을 넘어, 추후 <strong>Next.js 기반의 고성능 웹 애플리케이션으로 재구성</strong>하여 더 쾌적한 서비스를 제공해 드리기 위해 전용 도메인(<strong>wwmmap.kr</strong>)을 도입하게 되었습니다.
                    </p>
                    <p>
                        <strong>2025년 12월 27일부터</strong> 기존 GitHub 주소 접속 시 새로운 도메인으로 자동 리다이렉트될 예정입니다.
                    </p>
                    <div style="background: rgba(255, 87, 87, 0.1); border: 1px solid rgba(255, 87, 87, 0.3); padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <strong style="color: #ff6b6b; display: block; margin-bottom: 8px; font-size: 1.1em;">🚨 왜 데이터 백업이 필요한가요?</strong>
                        <p style="margin-bottom: 8px; font-size: 0.95em; line-height: 1.5;">
                            브라우저의 보안 정책(Same-Origin Policy)으로 인해, <strong>도메인이 달라지면 기존 도메인에 저장된 데이터에 접근할 수 없습니다.</strong> 
                            기술적인 한계로 인해 데이터를 자동으로 옮겨드릴 수 없으므로(할수만 있다면 가능하겠지만 보안이나 이것저것을 위해), 소중한 즐겨찾기와 설정 데이터를 지키기 위해 반드시 백업이 필요합니다.
                        </p>
                        <p style="margin: 0; font-weight: bold;">
                            [설정] > [데이터 백업] 기능을 통해 현재 데이터를 파일로 저장해 주세요.
                        </p>
                    </div>
                    <p style="font-size: 0.9em; color: #aaa;">
                        새로운 도메인에서 백업 파일을 불러오시면 모든 데이터를 그대로 이어가실 수 있습니다.<br />
                        더 나은 서비스를 위한 필수적인 과정이오니 너그러운 양해 부탁드립니다.
                    </p>
                </div>
                <div class="main-notice-footer">
                    <label class="main-notice-dont-show">
                        <input type="checkbox" id="chk-dont-show-notice" />
                        다시 보지 않기
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <button id="btn-just-close" style="background: transparent; border: 1px solid #666; color: #ccc; padding: 8px 16px; border-radius: 4px; cursor: pointer;">닫기</button>
                        <button class="main-notice-confirm-btn" id="btn-go-backup">지금 백업하러 가기</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-close-notice').addEventListener('click', closeNotice);
    document.getElementById('btn-just-close').addEventListener('click', closeNotice);

    document.getElementById('btn-go-backup').addEventListener('click', () => {
        closeNotice();
        const settingsBtn = document.getElementById('open-settings');
        if (settingsBtn) {
            settingsBtn.click();

            setTimeout(() => {
                const backupSection = document.querySelector('.settings-backup-section');
                if (backupSection) {
                    backupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    backupSection.classList.add('highlight-backup');

                    setTimeout(() => {
                        backupSection.classList.remove('highlight-backup');
                    }, 5000);
                }
            }, 300);
        }
    });

    document.getElementById('main-notice-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'main-notice-overlay') {
            closeNotice();
        }
    });
}

/**
 * Closes and removes the main notice modal and persists the "don't show again" choice when selected.
 *
 * If the "don't show again" checkbox is checked, sets the storage key `notice_hidden_${NOTICE_ID}` to `'true'` in the primary database.
 * Then removes the modal's `active` class and deletes the modal element from the DOM after a 300ms delay.
 */
function closeNotice() {
    const modal = document.getElementById('main-notice-overlay');
    const checkbox = document.getElementById('chk-dont-show-notice');

    if (checkbox && checkbox.checked) {
        import("./storage/db.js").then(({ primaryDb }) => {
            primaryDb.set(`notice_hidden_${NOTICE_ID}`, 'true');
        });
    }

    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}