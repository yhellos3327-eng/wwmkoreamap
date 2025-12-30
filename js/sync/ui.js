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
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 10000;
            display: none;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(5px);
            transition: opacity 0.3s ease;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes sync-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            #sync-tooltip .sync-spinner {
                display: inline-block;
                animation: sync-spin 1s linear infinite;
                font-size: 16px;
            }
            #sync-tooltip.sync-success { background: rgba(40, 167, 69, 0.9); }
            #sync-tooltip.sync-error { background: rgba(220, 53, 69, 0.9); }
            #sync-tooltip.sync-update { background: rgba(0, 123, 255, 0.9); }
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

    tooltip.className = '';
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
};

export const hideSyncTooltip = (delay = 0) => {
    setTimeout(() => {
        const tooltip = document.getElementById('sync-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }, delay);
};

export const showSyncToast = (message, type = 'info') => {
    let toast = document.getElementById('sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sync-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(5px);
            max-width: 300px;
        `;
        document.body.appendChild(toast);
    }

    if (type === 'success') toast.style.background = 'rgba(40, 167, 69, 0.9)';
    else if (type === 'update') toast.style.background = 'rgba(0, 123, 255, 0.9)';
    else toast.style.background = 'rgba(0, 0, 0, 0.85)';

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
};
