import { BACKEND_URL } from './config.js';

let currentUser = null;

const isLocalDev = () => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.includes('.local');
};

export const isLoggedIn = () => {
    return currentUser !== null;
};

export const getCurrentUser = () => {
    return currentUser;
};

const checkAuthStatus = async () => {
    if (isLocalDev()) {
        // In local dev, check localStorage for test login
        const testData = localStorage.getItem('wwm_test_user');
        if (testData) {
            currentUser = JSON.parse(testData);
        }
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/auth/user`, {
            credentials: 'include' // Important: send cookies
        });

        const data = await response.json();

        if (data.isAuthenticated && data.user) {
            currentUser = {
                id: data.user.id,
                name: data.user.display_name || '사용자',
                email: data.user.email,
                provider: data.user.provider
            };
        } else {
            currentUser = null;
        }
    } catch (error) {
        console.error('Failed to check auth status:', error);
        currentUser = null;
    }
};

export const loginWithProvider = (provider) => {
    if (isLocalDev()) {
        console.warn('OAuth login is not available in local development. Use test login instead.');
        alert('로컬 환경에서는 OAuth 로그인이 불가능합니다.\n테스트 로그인을 사용해주세요.');
        return;
    }

    // Store current URL to return after login
    localStorage.setItem('wwm_auth_return_url', window.location.href);

    // Redirect to backend OAuth
    window.location.href = `${BACKEND_URL}/auth/${provider}`;
};

export const testLogin = () => {
    if (!isLocalDev()) {
        console.warn('Test login is only available in local development.');
        return;
    }

    const testUser = {
        id: 'test-user-123',
        name: '테스트 사용자',
        email: 'test@example.com',
        provider: 'test'
    };

    localStorage.setItem('wwm_test_user', JSON.stringify(testUser));
    currentUser = testUser;

    console.log('Test login successful:', testUser);
    updateAuthUI();
};

export const logout = async () => {
    if (isLocalDev()) {
        localStorage.removeItem('wwm_test_user');
        currentUser = null;
        updateAuthUI();
        return;
    }

    // Redirect to backend logout
    window.location.href = `${BACKEND_URL}/auth/logout`;
};

export const updateAuthUI = () => {
    const loggedOutSection = document.getElementById('auth-logged-out');
    const loggedInSection = document.getElementById('auth-logged-in');
    const localDevSection = document.getElementById('local-dev-auth');

    const loggedIn = isLoggedIn();
    const user = getCurrentUser();

    // Settings modal auth UI
    if (loggedOutSection && loggedInSection) {
        loggedOutSection.style.display = loggedIn ? 'none' : 'block';
        loggedInSection.style.display = loggedIn ? 'flex' : 'none';
    }

    if (localDevSection) {
        localDevSection.style.display = (isLocalDev() && !loggedIn) ? 'block' : 'none';
    }

    if (loggedIn && user) {
        const avatarEl = document.getElementById('auth-user-avatar');
        const nameEl = document.getElementById('auth-user-name');
        const providerEl = document.getElementById('auth-user-provider');

        if (avatarEl) {
            avatarEl.src = user.avatar || 'https://via.placeholder.com/40/333/fff?text=?';
            avatarEl.onerror = () => {
                avatarEl.src = 'https://via.placeholder.com/40/333/fff?text=?';
            };
        }
        if (nameEl) nameEl.textContent = user.name || '사용자';
        if (providerEl) {
            const providerNames = {
                'google': 'Google',
                'kakao': 'Kakao',
                'test': 'Test Mode'
            };
            providerEl.textContent = providerNames[user.provider] || user.provider || '';
        }
    }
};

export const initAuth = async () => {
    // Check auth status from server
    await checkAuthStatus();

    // Setup button listeners (Settings modal)
    const kakaoBtn = document.getElementById('btn-kakao-login');
    const googleBtn = document.getElementById('btn-google-login');
    const testBtn = document.getElementById('btn-test-login');
    const logoutBtn = document.getElementById('btn-logout');

    if (kakaoBtn) {
        kakaoBtn.addEventListener('click', () => loginWithProvider('kakao'));
    }

    if (googleBtn) {
        googleBtn.addEventListener('click', () => loginWithProvider('google'));
    }

    if (testBtn) {
        testBtn.addEventListener('click', testLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Update UI
    updateAuthUI();

    console.log('[Auth] Initialized', {
        isLocalDev: isLocalDev(),
        isLoggedIn: isLoggedIn(),
        user: getCurrentUser()
    });
};