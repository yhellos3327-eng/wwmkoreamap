const createSyncTooltip = () => {
    let tooltip = document.getElementById('sync-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'sync-tooltip';
        tooltip.innerHTML = `
            <span class="sync-spinner">⟳</span>
            <span class="sync-text">동기화중...</span>
        `;
        tooltip.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(0);
            background: var(--bg-panel);
            backdrop-filter: var(--glass-blur) saturate(180%);
            -webkit-backdrop-filter: var(--glass-blur) saturate(180%);
            color: var(--text-main);
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            display: none;
            align-items: center;
            gap: 12px;
            box-shadow: var(--glass-shadow);
            border: 1px solid var(--glass-border);
            transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes sync-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            #sync-tooltip .sync-spinner {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                animation: sync-spin 1s linear infinite;
                font-size: 18px;
                color: var(--accent);
            }
            #sync-tooltip.sync-success { border-color: rgba(50, 215, 75, 0.4); }
            #sync-tooltip.sync-success .sync-spinner { color: var(--success); }
            
            #sync-tooltip.sync-error { border-color: rgba(255, 59, 48, 0.4); }
            #sync-tooltip.sync-error .sync-spinner { color: #ff3b30; }
            
            #sync-tooltip.sync-update { border-color: rgba(0, 122, 255, 0.4); }
            #sync-tooltip.sync-update .sync-spinner { color: #007aff; }

            #sync-tooltip.hidden {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(tooltip);
    }
    return tooltip;
};

export const showSyncTooltip = (message = '동기화중...', type = 'syncing') => {
    const tooltip = createSyncTooltip();
    const spinner = tooltip.querySelector('.sync-spinner');
    const text = tooltip.querySelector('.sync-text');

    tooltip.classList.remove('hidden', 'sync-success', 'sync-error', 'sync-update');

    if (type === 'success') {
        tooltip.classList.add('sync-success');
        spinner.textContent = '✓';
        spinner.style.animation = 'none';
    } else if (type === 'error') {
        tooltip.classList.add('sync-error');
        spinner.textContent = '✕';
        spinner.style.animation = 'none';
    } else if (type === 'update') {
        tooltip.classList.add('sync-update');
        spinner.textContent = '↻';
        spinner.style.animation = 'none';
    } else {
        spinner.textContent = '⟳';
        spinner.style.animation = 'sync-spin 1s linear infinite';
    }

    text.textContent = message;
    tooltip.style.display = 'flex';

    // Force reflow
    tooltip.offsetHeight;
    tooltip.classList.remove('hidden');
};

export const hideSyncTooltip = (delay = 0) => {
    setTimeout(() => {
        const tooltip = document.getElementById('sync-tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
            setTimeout(() => {
                if (tooltip.classList.contains('hidden')) {
                    tooltip.style.display = 'none';
                }
            }, 400); // Match transition duration
        }
    }, delay);
};

export const showSyncToast = (message, type = 'info') => {
    let toast = document.getElementById('sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sync-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--bg-panel);
            backdrop-filter: var(--glass-blur) saturate(180%);
            -webkit-backdrop-filter: var(--glass-blur) saturate(180%);
            color: var(--text-main);
            padding: 14px 24px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
            box-shadow: var(--glass-shadow);
            border: 1px solid var(--glass-border);
            max-width: 320px;
        `;
        document.body.appendChild(toast);
    }

    if (type === 'success') toast.style.borderColor = 'rgba(50, 215, 75, 0.4)';
    else if (type === 'update') toast.style.borderColor = 'rgba(0, 122, 255, 0.4)';
    else toast.style.borderColor = 'var(--glass-border)';

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
};
