export const THEME_KEY = 'wwm_theme'; // 'light', 'dark', 'system'

export const initTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
    applyTheme(savedTheme);

    // 시스템 테마 변경 감지
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem(THEME_KEY) === 'system') {
            applyTheme('system');
        }
    });
};

export const applyTheme = (theme) => {
    let effectiveTheme = theme;
    if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    localStorage.setItem(THEME_KEY, theme);

    // 상태 업데이트 (설정 모달 UI 동기화용)
    if (window.setState) {
        window.setState('currentTheme', theme);
    }
};

export const getTheme = () => {
    return localStorage.getItem(THEME_KEY) || 'system';
};
