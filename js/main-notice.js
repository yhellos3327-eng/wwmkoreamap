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
