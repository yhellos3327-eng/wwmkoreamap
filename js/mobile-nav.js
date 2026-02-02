import { state } from "./state.js";
import { MAP_CONFIGS } from "./config.js";

export const initMobileNav = () => {
    console.log("[MobileNav] Initializing...");

    // 1. Bottom Nav Logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.dataset.target;

            // UI Update
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            handleMobileNavClick(target);
        });
    });

    // 2. Region Selector Logic
    const regionBtn = document.getElementById('mobile-region-btn');
    if (regionBtn) {
        regionBtn.addEventListener('click', () => {
            openMobileRegionModal();
        });
    }

    // Sync region text on load
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
    // Check if open
    if (document.querySelector('.mobile-modal-overlay')) return;

    // Create modal DOM
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

    // Title
    const title = document.createElement('div');
    title.innerText = "지도 선택";
    title.style.cssText = "padding: 16px; text-align: center; color: #daac71; font-weight: bold; border-bottom: 1px solid #333; font-family: 'Wanted Sans Variable', 'Wanted Sans', sans-serif;";
    content.appendChild(title);

    // Options
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
                // Simulate click on desktop option to trigger all logic
                const desktopOption = document.querySelector(`.custom-option[data-value="${key}"]`);
                if (desktopOption) {
                    desktopOption.click();
                }
                updateMobileRegionText(); // Update local text immediately

                // Also close modal
                closeModal(modal);
            } else {
                closeModal(modal);
            }
        };
        content.appendChild(btn);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerText = "닫기";
    closeBtn.style.cssText = "width: 100%; padding: 16px; background: #1a1a1a; border: none; color: #aaa; font-family: 'Wanted Sans Variable', 'Wanted Sans', sans-serif;";
    closeBtn.onclick = () => closeModal(modal);
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Animation
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

    // Wait for state to be ready if needed
    if (el && state.currentMapKey && MAP_CONFIGS[state.currentMapKey]) {
        el.innerText = MAP_CONFIGS[state.currentMapKey].name;
    }
}
