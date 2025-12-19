const NOTICE_ID = '2025-12-20-domain-change-v2'; // ID updated to show for everyone again

export function initMainNotice() {
    const dontShowAgain = localStorage.getItem(`wwm_notice_hidden_${NOTICE_ID}`);

    if (dontShowAgain === 'true') {
        return;
    }

    createNoticeModal();
    setTimeout(() => {
        const modal = document.getElementById('main-notice-overlay');
        if (modal) {
            modal.classList.add('active');
        }
    }, 1000);
}

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

            // Wait for modal to open and then scroll/highlight
            setTimeout(() => {
                const backupSection = document.querySelector('.settings-backup-section');
                if (backupSection) {
                    backupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    backupSection.classList.add('highlight-backup');

                    // Remove highlight after animation finishes (1.5s * 3 = 4.5s)
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

function closeNotice() {
    const modal = document.getElementById('main-notice-overlay');
    const checkbox = document.getElementById('chk-dont-show-notice');

    if (checkbox && checkbox.checked) {
        localStorage.setItem(`wwm_notice_hidden_${NOTICE_ID}`, 'true');
    }

    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}
