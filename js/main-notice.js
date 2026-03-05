const NOTICE_ID = '2025-12-20-domain-change-v2';
const NOTICE_ID_DATA_SOURCE = '2026-03-05-data-source-warning';

export async function initMainNotice() {
    try {
        const { primaryDb } = await import("./storage/db.js");
        const dontShowAgain = await primaryDb.get(`notice_hidden_${NOTICE_ID}`);

        if (dontShowAgain === 'true') {
            return;
        }
    } catch (error) {
        console.error("Failed to check notice preference:", error);
    }

    createDomainToast();
}

export async function initDataSourceNotice() {
    try {
        const { primaryDb } = await import("./storage/db.js");
        const dontShowAgain = await primaryDb.get(`notice_hidden_${NOTICE_ID_DATA_SOURCE}`);

        if (dontShowAgain === 'true') {
            return;
        }
    } catch (error) {
        console.error("Failed to check data source notice preference:", error);
    }

    createDataSourceToast();
}

function createDomainToast() {
    if (document.getElementById('domain-toast')) return;

    const toastHtml = `
        <div id="domain-toast" class="main-toast">
            <div class="main-toast-content">
                <div class="main-toast-header">
                    <span class="main-toast-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    </span>
                    <span class="main-toast-title">도메인 변경 안내</span>
                    <button class="main-toast-close-x" id="btn-close-domain-x">&times;</button>
                </div>
                <div class="main-toast-body">
                    <p>더 쾌적한 서비스를 위해 <strong>wwmmap.kr</strong>로 전용 도메인을 도입합니다. 12/27부터 자동 리다이렉트됩니다.</p>
                    <p class="highlight-text">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: text-bottom;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        데이터 유실 방지를 위해 반드시 [데이터 백업]을 진행해 주세요!
                    </p>
                </div>
                <div class="main-toast-footer">
                    <label class="main-toast-dont-show">
                        <input type="checkbox" id="chk-dont-show-domain" />
                        다시 보지 않기
                    </label>
                    <div class="main-toast-buttons">
                        <button class="main-toast-btn-secondary" id="btn-close-domain">닫기</button>
                        <button class="main-toast-btn-primary" id="btn-go-backup-toast">지금 백업</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    injectToastIntoDOM(toastHtml, 'domain-toast', closeDomainToast);

    document.getElementById('btn-close-domain-x').addEventListener('click', closeDomainToast);
    document.getElementById('btn-close-domain').addEventListener('click', closeDomainToast);
    document.getElementById('btn-go-backup-toast').addEventListener('click', () => {
        closeDomainToast();
        const settingsBtn = document.getElementById('open-settings');
        if (settingsBtn) {
            settingsBtn.click();
            setTimeout(() => {
                const backupSection = document.querySelector('.settings-backup-section');
                if (backupSection) {
                    backupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    backupSection.classList.add('highlight-backup');
                    setTimeout(() => backupSection.classList.remove('highlight-backup'), 5000);
                }
            }, 300);
        }
    });
}

function createDataSourceToast() {
    if (document.getElementById('data-source-toast')) return;

    const toastHtml = `
        <div id="data-source-toast" class="main-toast ds-variant">
            <div class="main-toast-content">
                <div class="main-toast-header">
                    <span class="main-toast-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </span>
                    <span class="main-toast-title">데이터 출처 안내</span>
                    <button class="main-toast-close-x" id="btn-close-ds-x">&times;</button>
                </div>
                <div class="main-toast-body">
                    <p>모든 데이터와 이미지는 <strong>17173 사이트</strong> 기반입니다. 글로벌 서버 정보와 차이가 있을 수 있습니다.</p>
                </div>
                <div class="main-toast-footer">
                    <label class="main-toast-dont-show">
                        <input type="checkbox" id="chk-dont-show-ds-toast" />
                        다시 보지 않기
                    </label>
                    <button class="main-toast-btn-primary" id="btn-close-ds-toast">확인</button>
                </div>
            </div>
        </div>
    `;

    injectToastIntoDOM(toastHtml, 'data-source-toast', closeDataSourceToast);

    document.getElementById('btn-close-ds-x').addEventListener('click', closeDataSourceToast);
    document.getElementById('btn-close-ds-toast').addEventListener('click', closeDataSourceToast);
}

function injectToastIntoDOM(html, id, closeFn) {
    document.body.insertAdjacentHTML('beforeend', html);
    const toast = document.getElementById(id);

    // Position management if multiple toasts exist
    const existingToasts = document.querySelectorAll('.main-toast.active');
    const offset = existingToasts.length * 90; // Approx height + gap
    toast.style.top = `${20 + offset}px`;

    setTimeout(() => toast.classList.add('active'), 100);

    // Auto-dismiss after 15 seconds if not a domain notice (as it's critical)
    if (id !== 'domain-toast') {
        setTimeout(() => {
            if (document.getElementById(id)) closeFn();
        }, 15000);
    }
}

async function closeDomainToast() {
    const toast = document.getElementById('domain-toast');
    const checkbox = document.getElementById('chk-dont-show-domain');

    if (checkbox && checkbox.checked) {
        try {
            const { primaryDb } = await import("./storage/db.js");
            await primaryDb.set(`notice_hidden_${NOTICE_ID}`, 'true');
        } catch (error) {
            console.error("Failed to save domain notice preference:", error);
        }
    }

    if (toast) {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
            repositionToasts();
        }, 500);
    }
}

async function closeDataSourceToast() {
    const toast = document.getElementById('data-source-toast');
    const checkbox = document.getElementById('chk-dont-show-ds-toast');

    if (checkbox && checkbox.checked) {
        try {
            const { primaryDb } = await import("./storage/db.js");
            await primaryDb.set(`notice_hidden_${NOTICE_ID_DATA_SOURCE}`, 'true');
        } catch (error) {
            console.error("Failed to save data source notice preference:", error);
        }
    }

    if (toast) {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
            repositionToasts();
        }, 500);
    }
}

function repositionToasts() {
    const toasts = document.querySelectorAll('.main-toast.active');
    toasts.forEach((toast, index) => {
        toast.style.top = `${20 + index * 90}px`;
    });
}
