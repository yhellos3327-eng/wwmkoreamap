import { auth, firebaseInitialized } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { setIsAdmin, isAdmin } from './notice/state.js';
import { initTabs } from './notice/tabs.js';
import { renderLinks } from './notice/links.js';
import { renderSystemUpdates, renderTranslationUpdates, initUpdateEvents } from './notice/updates.js';
import { renderNotices, initNoticeEvents, initBoardEvents } from './notice/notices.js';
import { renderFreeBoardPosts, initFreeBoardEvents } from './notice/freeboard.js';
import { renderReportBoardPosts, initReportBoardEvents, showReportBoardWriteForm } from './notice/reports.js';

const init = async () => {
    await firebaseInitialized;

    onAuthStateChanged(auth, (user) => {
        const postAuthorInput = document.getElementById('post-author');
        const reportAuthorInput = document.getElementById('report-author');
        const adminBtns = document.querySelectorAll('.admin-only');

        if (user) {
            setIsAdmin(true);
            document.getElementById('btn-login').textContent = '🔓 로그아웃';
            document.body.classList.add('admin-mode');

            adminBtns.forEach(btn => btn.style.display = 'block');

            if (postAuthorInput) {
                postAuthorInput.value = '관리자';
                postAuthorInput.disabled = true;
                postAuthorInput.classList.add('admin-text');
            }
            if (reportAuthorInput) {
                reportAuthorInput.value = '관리자';
                reportAuthorInput.disabled = true;
                reportAuthorInput.classList.add('admin-text');
            }
        } else {
            setIsAdmin(false);
            document.getElementById('btn-login').textContent = '🔒 관리자 로그인';
            document.body.classList.remove('admin-mode');

            adminBtns.forEach(btn => btn.style.display = 'none');

            if (postAuthorInput) {
                postAuthorInput.value = '';
                postAuthorInput.disabled = false;
                postAuthorInput.classList.remove('admin-text');
            }
            if (reportAuthorInput) {
                reportAuthorInput.value = '';
                reportAuthorInput.disabled = false;
                reportAuthorInput.classList.remove('admin-text');
            }
        }

        
        renderSystemUpdates();
        renderTranslationUpdates();
        renderNotices();
        renderFreeBoardPosts();
        renderReportBoardPosts();
    });

    
    initLoginEvents();

    
    renderLinks();

    
    initTabs();
    initBoardEvents();
    initFreeBoardEvents();
    initReportBoardEvents();
    initUpdateEvents();
    initNoticeEvents();

    
    handleHashRouting();
};

const initLoginEvents = () => {
    const loginModal = document.getElementById('login-modal');
    const btnLogin = document.getElementById('btn-login');
    const btnPerformLogin = document.getElementById('btn-perform-login');
    const btnCloseLogin = document.getElementById('btn-close-login');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (isAdmin) {
                signOut(auth).then(() => {
                    alert('로그아웃되었습니다.');
                    window.location.reload();
                });
            } else {
                loginModal.style.display = 'flex';
            }
        });
    }

    if (btnCloseLogin) {
        btnCloseLogin.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });
    }

    if (btnPerformLogin) {
        btnPerformLogin.addEventListener('click', async () => {
            const email = emailInput.value;
            const password = passwordInput.value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                loginModal.style.display = 'none';
                alert('관리자로 로그인되었습니다.');
            } catch (error) {
                console.error("Login failed:", error);
                alert("로그인 실패: " + error.message);
            }
        });
    }
};

const handleHashRouting = () => {
    if (window.location.hash === '#report') {
        const reportTab = document.querySelector('.board-tab[data-tab="report-board-section"]');
        if (reportTab) reportTab.click();

        const reportTarget = localStorage.getItem('wwm_report_target');
        if (reportTarget) {
            showReportBoardWriteForm();
            try {
                const parsed = JSON.parse(reportTarget);
                document.getElementById('report-json').value = JSON.stringify(parsed, null, 4);
                document.getElementById('report-json-group').style.display = 'block';
                if (parsed.name) {
                    document.getElementById('report-title').value = `[오류 제보] ${parsed.name}`;
                }
            } catch (e) {
                document.getElementById('report-json').value = reportTarget;
                document.getElementById('report-json-group').style.display = 'block';
            }
        }
    }
};


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
