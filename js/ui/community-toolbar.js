// @ts-check
import { state } from "../state.js";

/**
 * Community Toolbar Component
 */
class CommunityToolbar {
    constructor() {
        this.element = null;
        this.activeTool = null; // 'add', 'move', 'delete'
    }

    /**
     * Initialize and render the toolbar
     */
    init() {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.className = 'community-toolbar';
        this.element.innerHTML = `
            <button class="community-tool-btn" data-tool="add" title="마커 추가 (빈 땅 클릭)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                <span class="label">추가</span>
            </button>
            <button class="community-tool-btn" data-tool="move" title="위치 수정 (마커 선택 후 이동)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3-3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
                <span class="label">이동</span>
            </button>
            <button class="community-tool-btn" data-tool="delete" title="마커 삭제 (마커 클릭 시 삭제 제안)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                <span class="label">삭제</span>
            </button>
        `;

        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.appendChild(this.element);
        }

        this.setupEvents();
    }

    setupEvents() {
        const buttons = /** @type {NodeListOf<HTMLElement>} */ (this.element.querySelectorAll('.community-tool-btn'));
        buttons.forEach(btn => {
            btn.onclick = () => {
                const tool = btn.getAttribute('data-tool');
                if (tool) this.toggleTool(tool);
            };
        });
    }

    /**
     * @param {string} tool 
     */
    toggleTool(tool) {
        if (this.activeTool === tool) {
            this.deactivateAll();
            return;
        }

        this.deactivateAll();
        this.activeTool = tool;

        const btn = this.element.querySelector(`[data-tool="${tool}"]`);
        if (btn) btn.classList.add('active');

        // Logic integration
        import("../dev-tools.js").then(m => {
            // @ts-ignore
            if (typeof m.setDevMode === 'function') m.setDevMode(tool);
        });
    }

    deactivateAll() {
        this.activeTool = null;
        this.element.querySelectorAll('.community-tool-btn').forEach(b => b.classList.remove('active'));

        import("../dev-tools.js").then(m => {
            // @ts-ignore
            if (typeof m.setDevMode === 'function') m.setDevMode(null);
        });
    }

    show() {
        if (!this.element) this.init();
        this.element.classList.add('active');
    }

    hide() {
        if (this.element) {
            this.element.classList.remove('active');
            this.deactivateAll();
        }
    }
}

export const communityToolbar = new CommunityToolbar();
