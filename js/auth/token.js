/**
 * JWT Token Management (Frontend)
 *
 * Note: Tokens are stored as httpOnly cookies by the server.
 * JavaScript CANNOT access httpOnly cookies (security feature to prevent XSS).
 * Tokens are automatically sent with every request via 'credentials: include'.
 */

/**
 * Check if user is currently authenticated by fetching /auth/user
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  try {
    const response = await fetch('/api/auth/user', {
      method: 'GET',
      credentials: 'include', // Send httpOnly cookies
    });
    const data = await response.json();
    return data.isAuthenticated === true;
  } catch (err) {
    console.error('[Auth] isAuthenticated error:', err.message);
    return false;
  }
}

/**
 * Get current user info from server
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/user', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (data.isAuthenticated && data.user) {
      return data.user;
    }
    return null;
  } catch (err) {
    console.error('[Auth] getCurrentUser error:', err.message);
    return null;
  }
}

/**
 * Refresh access token using the refresh token
 * Server will set new httpOnly cookies automatically
 * @returns {Promise<boolean>} true if refresh succeeded
 */
export async function refreshToken() {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
    return false;
  } catch (err) {
    console.error('[Auth] refreshToken error:', err.message);
    return false;
  }
}

/**
 * Logout user (clears httpOnly cookies on server)
 * @returns {Promise<boolean>}
 */
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch (err) {
    console.error('[Auth] logout error:', err.message);
    return false;
  }
}

/**
 * Start OAuth login flow (Google)
 */
export function loginWithGoogle() {
  // Redirect to backend OAuth endpoint
  // Server will exchange code for JWT and set cookies automatically
  window.location.href = '/api/auth/google';
}

/**
 * Start OAuth login flow (Kakao)
 */
export function loginWithKakao() {
  // Redirect to backend OAuth endpoint
  // Server will exchange code for JWT and set cookies automatically
  window.location.href = '/api/auth/kakao';
}

/**
 * Setup automatic token refresh before expiration
 * This polls the server and refreshes the token every 13 minutes (before 15-min expiry)
 */
export function setupAutoRefresh() {
  // Refresh every 13 minutes (before 15-min access token expiry)
  const REFRESH_INTERVAL = 13 * 60 * 1000;

  setInterval(async () => {
    const success = await refreshToken();
    if (!success) {
      console.warn('[Auth] Token refresh failed - user may need to re-login');
    }
  }, REFRESH_INTERVAL);
}
