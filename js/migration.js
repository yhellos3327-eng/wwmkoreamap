const OLD_DOMAIN = 'yhellos3327-eng.github.io';
const NEW_DOMAIN = 'wwmmap.kr';

export function isOldDomain() {
    return window.location.hostname === OLD_DOMAIN;
}

export function hasMigrationParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get('migrate') === 'true';
}

export function showMigrationModal() {
    if (!isOldDomain()) return;

    if (document.getElementById('migration-overlay')) return;

    const hasData = Object.keys(localStorage).length > 0;

    const modalHtml = `
        <div id="migration-overlay" class="migration-overlay">
            <div class="migration-content">
                <div class="migration-header">
                    <h2 class="migration-title">🚚 도메인 이전 안내</h2>
                </div>
                <div class="migration-body">
                    <div class="migration-warning">
                        <strong>📍 이 주소는 옛 주소입니다!</strong>
                        <p>연운 한국어 맵은 새로운 도메인으로 이전했습니다.</p>
                    </div>
                    
                    <div class="migration-domains">
                        <div class="domain-row old">
                            <span class="domain-label">기존 주소</span>
                            <span class="domain-url">${OLD_DOMAIN}/wwmkoreamap</span>
                        </div>
                        <div class="domain-arrow">➡️</div>
                        <div class="domain-row new">
                            <span class="domain-label">새 주소</span>
                            <span class="domain-url">${NEW_DOMAIN}</span>
                        </div>
                    </div>
                    
                    ${hasData ? `
                        <div class="migration-data-notice">
                            <strong>💾 저장된 데이터가 있습니다!</strong>
                            <p>브라우저 보안 정책으로 인해 데이터를 자동으로 이전할 수 없습니다.<br/>
                            아래 버튼을 클릭하면 데이터를 백업 파일로 저장한 후 새 도메인으로 이동합니다.</p>
                        </div>
                    ` : `
                        <div class="migration-no-data">
                            <p>저장된 데이터가 없습니다. 새 도메인으로 바로 이동합니다.</p>
                        </div>
                    `}
                </div>
                <div class="migration-footer">
                    ${hasData ? `
                        <button id="btn-migrate-with-backup" class="migration-btn primary">
                            📥 데이터 저장 후 새 도메인으로 이동
                        </button>
                        <button id="btn-migrate-without-backup" class="migration-btn secondary">
                            데이터 없이 바로 이동
                        </button>
                    ` : `
                        <button id="btn-migrate-direct" class="migration-btn primary">
                            새 도메인으로 이동
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    addMigrationStyles();

    setTimeout(() => {
        const modal = document.getElementById('migration-overlay');
        if (modal) modal.classList.add('active');
    }, 100);

    const migrateWithBackupBtn = document.getElementById('btn-migrate-with-backup');
    const migrateWithoutBackupBtn = document.getElementById('btn-migrate-without-backup');
    const migrateDirectBtn = document.getElementById('btn-migrate-direct');

    if (migrateWithBackupBtn) {
        migrateWithBackupBtn.addEventListener('click', handleMigrateWithBackup);
    }

    if (migrateWithoutBackupBtn) {
        migrateWithoutBackupBtn.addEventListener('click', handleMigrateWithoutBackup);
    }

    if (migrateDirectBtn) {
        migrateDirectBtn.addEventListener('click', handleMigrateDirect);
    }
}

function handleMigrateWithBackup() {
    try {
        const data = { ...localStorage };
        if (Object.keys(data).length === 0) {
            alert('저장할 데이터가 없습니다. 새 도메인으로 이동합니다.');
            redirectToNewDomain();
            return;
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const fileName = `wwm_migration_backup_${dateStr}.json`;
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
            alert('백업 파일이 저장되었습니다.\n새 도메인으로 이동합니다. 설정 > 데이터 불러오기에서 백업 파일을 업로드해주세요.');
            redirectToNewDomain(true);
        }, 500);

    } catch (err) {
        console.error('백업 실패:', err);
        alert('데이터 백업 중 오류가 발생했습니다.\n' + err.message);
    }
}

function handleMigrateWithoutBackup() {
    if (confirm('⚠️ 주의!\n\n현재 저장된 즐겨찾기, 완료 표시 등 모든 데이터가 새 도메인에서 사용할 수 없게 됩니다.\n\n정말 데이터 없이 이동하시겠습니까?')) {
        redirectToNewDomain();
    }
}

function handleMigrateDirect() {
    redirectToNewDomain();
}

function redirectToNewDomain(openSettings = false) {
    let newUrl = `https://${NEW_DOMAIN}/`;
    const params = new URLSearchParams(window.location.search);

    if (openSettings) {
        params.set('migrate', 'true');
    }

    const paramString = params.toString();
    if (paramString) {
        newUrl += '?' + paramString;
    }

    window.location.href = newUrl;
}

export function handleMigrationComplete() {
    if (!hasMigrationParam()) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('migrate');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
    window.history.replaceState({}, '', newUrl);

    setTimeout(() => {
        const settingsBtn = document.getElementById('open-settings');
        if (settingsBtn) {
            settingsBtn.click();
            setTimeout(() => {
                const backupSection = document.querySelector('.settings-backup-section');
                if (backupSection) {
                    backupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    backupSection.classList.add('highlight-backup');

                    showMigrationWelcomeMessage(backupSection);

                    setTimeout(() => {
                        backupSection.classList.remove('highlight-backup');
                    }, 8000);
                }
            }, 300);
        }
    }, 1500);
}

function showMigrationWelcomeMessage(backupSection) {
    addMigrationStyles();

    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'migration-welcome-msg';
    welcomeMsg.innerHTML = `
        <div class="migration-welcome-content">
            <span class="migration-welcome-icon">👋</span>
            <div class="migration-welcome-text">
                <strong>기존 도메인에서 이동하셨군요!</strong>
                <p>아래 "데이터 불러오기" 버튼을 클릭하여 방금 다운로드한 백업 파일을 선택해주세요.</p>
            </div>
            <button class="migration-welcome-close" id="btn-close-migration-welcome">✕</button>
        </div>
    `;

    backupSection.insertAdjacentElement('beforebegin', welcomeMsg);

    document.getElementById('btn-close-migration-welcome')?.addEventListener('click', () => {
        welcomeMsg.remove();
    });

    setTimeout(() => {
        if (welcomeMsg.parentNode) {
            welcomeMsg.classList.add('fade-out');
            setTimeout(() => welcomeMsg.remove(), 300);
        }
    }, 8000);
}

function addMigrationStyles() {
    if (document.getElementById('migration-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'migration-styles';
    styles.textContent = `
        .migration-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .migration-overlay.active {
            opacity: 1;
        }
        
        .migration-content {
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            transform: translateY(20px);
            transition: transform 0.3s ease;
        }
        
        .migration-overlay.active .migration-content {
            transform: translateY(0);
        }
        
        .migration-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 20px;
            text-align: center;
        }
        
        .migration-title {
            margin: 0;
            color: white;
            font-size: 1.4em;
            font-weight: 700;
        }
        
        .migration-body {
            padding: 24px;
            color: #e0e0e0;
        }
        
        .migration-warning {
            background: rgba(255, 193, 7, 0.15);
            border: 1px solid rgba(255, 193, 7, 0.3);
            padding: 16px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        
        .migration-warning strong {
            color: #ffc107;
            font-size: 1.1em;
            display: block;
            margin-bottom: 8px;
        }
        
        .migration-warning p {
            margin: 0;
            color: #ccc;
            font-size: 0.95em;
        }
        
        .migration-domains {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .domain-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 8px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .domain-row.old {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
        }
        
        .domain-row.new {
            background: rgba(102, 126, 234, 0.15);
            border: 1px solid rgba(102, 126, 234, 0.4);
        }
        
        .domain-label {
            font-size: 0.8em;
            color: #888;
            min-width: 60px;
        }
        
        .domain-url {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
            color: #fff;
            word-break: break-all;
        }
        
        .domain-arrow {
            font-size: 1.5em;
            margin: 4px 0;
        }
        
        .migration-data-notice {
            background: rgba(52, 152, 219, 0.15);
            border: 1px solid rgba(52, 152, 219, 0.3);
            padding: 16px;
            border-radius: 10px;
        }
        
        .migration-data-notice strong {
            color: #3498db;
            display: block;
            margin-bottom: 8px;
        }
        
        .migration-data-notice p {
            margin: 0;
            font-size: 0.9em;
            line-height: 1.6;
            color: #ccc;
        }
        
        .migration-no-data {
            text-align: center;
            color: #888;
            padding: 16px;
        }
        
        .migration-footer {
            padding: 16px 24px 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .migration-btn {
            padding: 14px 24px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .migration-btn.primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .migration-btn.primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        .migration-btn.secondary {
            background: transparent;
            border: 1px solid #666;
            color: #aaa;
        }
        
        .migration-btn.secondary:hover {
            border-color: #888;
            color: #ddd;
        }
        
        /* 환영 메시지 스타일 */
        .migration-welcome-msg {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
            border: 1px solid rgba(102, 126, 234, 0.4);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            animation: slideDown 0.3s ease;
        }
        
        .migration-welcome-msg.fade-out {
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
        }
        
        .migration-welcome-content {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .migration-welcome-icon {
            font-size: 1.8em;
            flex-shrink: 0;
        }
        
        .migration-welcome-text {
            flex: 1;
        }
        
        .migration-welcome-text strong {
            display: block;
            margin-bottom: 4px;
            color: #fff;
        }
        
        .migration-welcome-text p {
            margin: 0;
            font-size: 0.9em;
            color: #ccc;
            line-height: 1.5;
        }
        
        .migration-welcome-close {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            color: #aaa;
            cursor: pointer;
            font-size: 1em;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s ease;
            line-height: 1;
        }
        
        .migration-welcome-close:hover {
            background: rgba(255, 107, 107, 0.3);
            border-color: rgba(255, 107, 107, 0.5);
            color: #ff6b6b;
            transform: scale(1.1);
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @media (max-width: 500px) {
            .migration-content {
                margin: 10px;
            }
            
            .migration-header {
                padding: 16px;
            }
            
            .migration-title {
                font-size: 1.2em;
            }
            
            .migration-body {
                padding: 16px;
            }
            
            .domain-url {
                font-size: 0.8em;
            }
        }
    `;

    document.head.appendChild(styles);
}

export function initMigration() {
    if (isOldDomain()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showMigrationModal);
        } else {
            showMigrationModal();
        }
    }

    if (hasMigrationParam()) {
        handleMigrationComplete();
    }
}
