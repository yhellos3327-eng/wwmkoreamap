import { state } from "./state.js";
import { MAP_CONFIGS } from "./config.js";

export const initMobileNav = () => {
    console.log("[MobileNav] Initializing...");

    // 1. 하단 내비게이션 로직
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.dataset.target;

            // UI 업데이트
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            handleMobileNavClick(target);
        });
    });

    // 2. 지역 선택기 로직
    const regionBtn = document.getElementById('mobile-region-btn');
    if (regionBtn) {
        regionBtn.addEventListener('click', () => {
            openMobileRegionModal();
        });
    }

    // 로드 시 지역 텍스트 동기화
    updateMobileRegionText();

    // Listen for map changes to update text
    // We can hijack this via checking state periodically or just relying on clicks.
    // Ideally we subscribe to state, but existing 'subscribe' might be complex to hook here.
    // For now, simple update on init is enough.
};

const handleMobileNavClick = (target) => {
    const sidebar = document.querySelector('.sidebar');

    switch (target) {
        case 'home':
            sidebar.classList.remove('open');
            break;
        case 'list':
            sidebar.classList.add('open');
            break;
        case 'route':
            {
                const btn = document.getElementById('route-mode-toggle');
                if (btn) btn.click();
            }
            break;
        case 'community':
            {
                const btn = document.getElementById('community-mode-toggle-top');
                if (btn) btn.click();
            }
            break;
        case 'more':
            window.open('https://arca.live/b/wwmmap', '_blank');
            break;
    }
};

const openMobileRegionModal = () => {
    // 열려 있는지 확인
    if (document.querySelector('.mobile-modal-overlay')) return;

    // 모달 DOM 생성
    const modal = document.createElement('div');
    modal.className = 'mobile-modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 5000;
        display: flex; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.2s;
    `;

    const content = document.createElement('div');
    content.className = 'mobile-modal-content';
    content.style.cssText = `
        background: #222; width: 80%; max-width: 300px;
        border-radius: 12px; overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        transform: scale(0.9); transition: transform 0.2s;
    `;

    // 제목
    const title = document.createElement('div');
    title.innerText = "지도 선택";
    title.style.cssText = "padding: 16px; text-align: center; color: #daac71; font-weight: bold; border-bottom: 1px solid #333; font-family: 'Wanted Sans Variable', 'Wanted Sans', sans-serif;";
    content.appendChild(title);

    // 옵션
    Object.keys(MAP_CONFIGS).forEach(key => {
        const config = MAP_CONFIGS[key];
        const btn = document.createElement('button');
        btn.innerText = config.name;
        btn.style.cssText = `
            width: 100%; padding: 16px; background: none; border: none;
            color: #eee; font-size: 16px; border-bottom: 1px solid #333;
            cursor: pointer; font-family: 'Wanted Sans Variable', 'Wanted Sans', sans-serif;
            display: flex; justify-content: space-between; align-items: center;
        `;

        if (state.currentMapKey === key) {
            btn.style.color = "#daac71";
            btn.style.fontWeight = "bold";
            btn.innerHTML += ' <span style="color:#daac71">✓</span>';
        }

        btn.onclick = () => {
            if (state.currentMapKey !== key) {
                // 모든 로직을 트리거하기 위해 데스크톱 옵션 클릭 시뮬레이션
                const desktopOption = document.querySelector(`.custom-option[data-value="${key}"]`);
                if (desktopOption) {
                    desktopOption.click();
                }
                updateMobileRegionText(); // 즉시 로컬 텍스트 업데이트

                // 모달 닫기
                closeModal(modal);
            } else {
                closeModal(modal);
            }
        };
        content.appendChild(btn);
    });

    // 닫기 버튼
    const closeBtn = document.createElement('button');
    closeBtn.innerText = "닫기";
    closeBtn.style.cssText = "width: 100%; padding: 16px; background: #1a1a1a; border: none; color: #aaa; font-family: 'Wanted Sans Variable', 'Wanted Sans', sans-serif;";
    closeBtn.onclick = () => closeModal(modal);
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 애니메이션
    requestAnimationFrame(() => {
        modal.style.opacity = "1";
        content.style.transform = "scale(1)";
    });
};

const closeModal = (modal) => {
    modal.style.opacity = "0";
    if (modal.firstChild) modal.firstChild.style.transform = "scale(0.9)";
    setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
    }, 200);
}

export const updateMobileRegionText = () => {
    const el = document.getElementById('mobile-region-text');
    // We import state freshly or use the one from module scope. 
    // Ideally subscribe, but polling or event-based is easier.
    // Since this function is exported, we can call it from elsewhere if needed.

    // 필요한 경우 state가 준비될 때까지 대기
    if (el && state.currentMapKey && MAP_CONFIGS[state.currentMapKey]) {
        el.innerText = MAP_CONFIGS[state.currentMapKey].name;
    }
}
