import { BACKEND_URL } from './config.js';

const isLocalDev = () => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.includes('.local');
};

const getToken = () => localStorage.getItem('wwm_access_token');
const setToken = (token) => localStorage.setItem('wwm_access_token', token);
const removeToken = () => localStorage.removeItem('wwm_access_token');
const getUserData = () => {
    const data = localStorage.getItem('wwm_user_data');
    return data ? JSON.parse(data) : null;
};

const setUserData = (user) => {
    localStorage.setItem('wwm_user_data', JSON.stringify(user));
};

const removeUserData = () => {
    localStorage.removeItem('wwm_user_data');
};

export const isLoggedIn = () => {
    return !!getToken();
};

export const getCurrentUser = () => {
    return getUserData();
};

const fetchUserProfile = async () => {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${BACKEND_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }

        const user = await response.json();
        setUserData(user);
        return user;
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        logout();
        return null;
    }
};

export const loginWithProvider = (provider) => {
    if (isLocalDev()) {
        console.warn('OAuth login is not available in local development. Use test login instead.');
        alert('로컬 환경에서는 OAuth 로그인이 불가능합니다.\n테스트 로그인을 사용해주세요.');
        return;
    }

    localStorage.setItem('wwm_auth_return_url', window.location.href);

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
        avatar: 'https://via.placeholder.com/40/FFB6C1/000000?text=T',
        provider: 'test'
    };

    setToken('test-token-for-local-development');
    setUserData(testUser);

    console.log('Test login successful:', testUser);
    updateAuthUI();
};

export const logout = () => {
    removeToken();
    removeUserData();
    updateAuthUI();
};

export const updateAuthUI = () => {
    const loggedOutSection = document.getElementById('auth-logged-out');
    const loggedInSection = document.getElementById('auth-logged-in');
    const localDevSection = document.getElementById('local-dev-auth');

    if (!loggedOutSection || !loggedInSection) return;

    const loggedIn = isLoggedIn();
    const user = getCurrentUser();

    loggedOutSection.style.display = loggedIn ? 'none' : 'flex';
    loggedInSection.style.display = loggedIn ? 'flex' : 'none';

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

export const initAuth = () => {
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

    updateAuthUI();

    if (isLoggedIn() && !isLocalDev()) {
        fetchUserProfile().catch(console.error);
    }

    console.log('[Auth] Initialized', {
        isLocalDev: isLocalDev(),
        isLoggedIn: isLoggedIn()
    });
};
