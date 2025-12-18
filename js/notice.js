import { systemUpdates, translationUpdates, usefulLinks, noticeData } from './config.js';
import { db, storage, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

let currentNoticeId = null;
let currentPostId = null;
let currentReportId = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        const postAuthorInput = document.getElementById('post-author');
        const reportAuthorInput = document.getElementById('report-author');
        const adminBtns = document.querySelectorAll('.admin-only');

        if (user) {
            isAdmin = true;
            document.getElementById('btn-login').textContent = '🔓 로그아웃';
            document.body.classList.add('admin-mode');

            // Show Admin Buttons
            adminBtns.forEach(btn => btn.style.display = 'block');

            // Fix Nickname for Admin
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
            isAdmin = false;
            document.getElementById('btn-login').textContent = '🔒 관리자 로그인';
            document.body.classList.remove('admin-mode');

            // Hide Admin Buttons
            adminBtns.forEach(btn => btn.style.display = 'none');

            // Reset Nickname fields
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
    });

    // Login Modal Events
    const loginModal = document.getElementById('login-modal');
    const btnLogin = document.getElementById('btn-login');
    const btnPerformLogin = document.getElementById('btn-perform-login');
    const btnCloseLogin = document.getElementById('btn-close-login');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

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

    btnCloseLogin.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });

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

    // Initial Renders
    renderSystemUpdates();
    renderTranslationUpdates();
    renderLinks();
    renderNotices();
    renderFreeBoardPosts();
    renderReportBoardPosts();

    initTabs();
    initBoardEvents();
    initFreeBoardEvents();
    initReportBoardEvents();
    initAdminWriteEvents();

    // Check for report data or hash
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
});

// New Render Functions for Updates (Firestore + Static)
async function renderSystemUpdates() {
    const listEl = document.getElementById('system-update-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="post-item" style="text-align: center; padding: 40px; color: #666;">로딩 중...</div>';

    let updates = [...systemUpdates]; // Start with static data

    try {
        const q = query(collection(db, "system_updates"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const firestoreUpdates = [];
        querySnapshot.forEach((doc) => {
            firestoreUpdates.push(doc.data());
        });
        // Merge: Firestore updates first
        updates = [...firestoreUpdates, ...updates];
    } catch (error) {
        console.error("Error loading system updates:", error);
    }

    listEl.innerHTML = '';
    updates.forEach((update, index) => {
        const isLatest = index === 0;
        const div = document.createElement('div');
        div.className = 'post-item';

        // Handle content array or string (Firestore might save as string with newlines)
        let contentHtml = '';
        if (Array.isArray(update.content)) {
            contentHtml = update.content.map(line => `<li>${line}</li>`).join('');
        } else {
            contentHtml = update.content.split('\n').map(line => `<li>${line}</li>`).join('');
        }

        const badgeHtml = isLatest ? '<span class="latest-badge">NEW</span>' : '';
        div.style.animationDelay = `${index * 0.1}s`;

        div.innerHTML = `
            <div class="post-header">
                <div class="post-title">
                    ${update.version} 업데이트 ${badgeHtml}
                </div>
                <span class="post-date">${update.date}</span>
            </div>
            <div class="post-content">
                <ul>${contentHtml}</ul>
            </div>
        `;
        listEl.appendChild(div);
    });
}

async function renderTranslationUpdates() {
    const listEl = document.getElementById('translation-update-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="post-item" style="text-align: center; padding: 40px; color: #666;">로딩 중...</div>';

    let updates = [...translationUpdates];

    try {
        const q = query(collection(db, "translation_updates"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const firestoreUpdates = [];
        querySnapshot.forEach((doc) => {
            firestoreUpdates.push(doc.data());
        });
        updates = [...firestoreUpdates, ...updates];
    } catch (error) {
        console.error("Error loading translation updates:", error);
    }

    listEl.innerHTML = '';
    updates.forEach((update, index) => {
        const isLatest = index === 0;
        const div = document.createElement('div');
        div.className = 'post-item';

        let contentHtml = '';
        if (Array.isArray(update.content)) {
            contentHtml = update.content.map(line => `<li>${line}</li>`).join('');
        } else {
            contentHtml = update.content.split('\n').map(line => `<li>${line}</li>`).join('');
        }

        const badgeHtml = isLatest ? '<span class="latest-badge">NEW</span>' : '';
        div.style.animationDelay = `${index * 0.1}s`;

        div.innerHTML = `
            <div class="post-header">
                <div class="post-title">
                    ${update.version} 업데이트 ${badgeHtml}
                </div>
                <span class="post-date">${update.date}</span>
            </div>
            <div class="post-content">
                <ul>${contentHtml}</ul>
            </div>
        `;
        listEl.appendChild(div);
    });
}

async function renderNotices() {
    const tbody = document.getElementById('notice-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    let notices = [...noticeData];

    try {
        const q = query(collection(db, "notices"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const firestoreNotices = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id; // Use doc ID for Firestore items
            // Or maybe we want a numeric ID? For now let's use what we have.
            // Existing static data has numeric IDs.
            firestoreNotices.push(data);
        });
        // Merge
        notices = [...firestoreNotices, ...notices];
    } catch (error) {
        console.error("Error loading notices:", error);
    }

    tbody.innerHTML = '';
    let totalCount = notices.length;
    notices.forEach((notice, index) => {
        const tr = document.createElement('tr');
        // Sequential ID: Total - Index
        const idDisplay = totalCount - index;

        tr.innerHTML = `
            <td class="col-id">${idDisplay}</td>
            <td class="col-title">${notice.title}</td>
            <td class="col-author">${formatAuthor(notice.author)}</td>
            <td class="col-date">${notice.date}</td>
        `;
        tr.addEventListener('click', () => viewNotice(notice));
        tbody.appendChild(tr);
    });
}

function viewNotice(notice) {
    document.getElementById('notice-list-view').style.display = 'none';
    document.getElementById('notice-write-view').style.display = 'none'; // Ensure write view is hidden
    const detailView = document.getElementById('notice-detail-view');
    detailView.style.display = 'flex';
    detailView.classList.add('active'); // Ensure active class

    document.getElementById('detail-title').textContent = notice.title;
    document.getElementById('detail-author').innerHTML = `작성자: ${formatAuthor(notice.author)}`;
    document.getElementById('detail-date').textContent = `작성일: ${notice.date}`;
    document.getElementById('detail-content').innerHTML = marked.parse(notice.content);

    // Admin Delete Button for Notice
    const existingDeleteBtn = document.getElementById('admin-notice-delete-btn');
    if (existingDeleteBtn) existingDeleteBtn.remove();

    // Only allow deleting Firestore notices (string ID > 5 chars)
    if (isAdmin && typeof notice.id === 'string' && notice.id.length > 5) {
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'admin-notice-delete-btn';
        deleteBtn.textContent = '공지 삭제';
        deleteBtn.style.marginLeft = '15px';
        deleteBtn.style.padding = '2px 8px';
        deleteBtn.style.background = '#ff5555';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '0.8rem';

        deleteBtn.addEventListener('click', async () => {
            if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
                try {
                    await deleteDoc(doc(db, "notices", notice.id));
                    alert('삭제되었습니다.');
                    // Return to list
                    document.getElementById('btn-back-to-list').click();
                    renderNotices();
                } catch (error) {
                    console.error("Error deleting notice:", error);
                    alert("삭제 실패: " + error.message);
                }
            }
        });

        document.getElementById('detail-date').appendChild(deleteBtn);
    }

    // Comments for notices
    const entityId = (typeof notice.id === 'string' && notice.id.length > 5) ? `notice_${notice.id}` : `notice_static_${notice.id}`;
    currentNoticeId = entityId; // Reuse currentNoticeId for comments
    renderComments(entityId, 'comment-list');
}

// Admin Write Event Listeners
function initAdminWriteEvents() {
    // System Update
    document.getElementById('btn-show-system-write').addEventListener('click', () => {
        document.getElementById('system-update-list-view').classList.remove('active');
        document.getElementById('system-update-write-view').classList.add('active');
    });
    document.getElementById('btn-cancel-system-write').addEventListener('click', () => {
        document.getElementById('system-update-write-view').classList.remove('active');
        document.getElementById('system-update-list-view').classList.add('active');
    });
    document.getElementById('btn-submit-system-update').addEventListener('click', async () => {
        const version = document.getElementById('system-version').value;
        const content = document.getElementById('system-content').value;
        if (!version || !content) return alert('버전과 내용을 입력하세요.');

        try {
            await addDoc(collection(db, "system_updates"), {
                version: version,
                content: content, // Save as string, split on render
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            alert('업데이트가 등록되었습니다.');
            document.getElementById('system-version').value = '';
            document.getElementById('system-content').value = '';
            document.getElementById('btn-cancel-system-write').click();
            renderSystemUpdates();
        } catch (e) {
            console.error(e);
            alert('등록 실패');
        }
    });

    // Translation Update
    document.getElementById('btn-show-translation-write').addEventListener('click', () => {
        document.getElementById('translation-update-list-view').classList.remove('active');
        document.getElementById('translation-update-write-view').classList.add('active');
    });
    document.getElementById('btn-cancel-translation-write').addEventListener('click', () => {
        document.getElementById('translation-update-write-view').classList.remove('active');
        document.getElementById('translation-update-list-view').classList.add('active');
    });
    document.getElementById('btn-submit-translation-update').addEventListener('click', async () => {
        const version = document.getElementById('translation-version').value;
        const content = document.getElementById('translation-content').value;
        if (!version || !content) return alert('버전과 내용을 입력하세요.');

        try {
            await addDoc(collection(db, "translation_updates"), {
                version: version,
                content: content,
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            alert('업데이트가 등록되었습니다.');
            document.getElementById('translation-version').value = '';
            document.getElementById('translation-content').value = '';
            document.getElementById('btn-cancel-translation-write').click();
            renderTranslationUpdates();
        } catch (e) {
            console.error(e);
            alert('등록 실패');
        }
    });

    // Notice
    document.getElementById('btn-show-notice-write').addEventListener('click', () => {
        document.getElementById('notice-list-view').style.display = 'none';
        document.getElementById('notice-detail-view').style.display = 'none';
        document.getElementById('notice-write-view').style.display = 'flex';
        document.getElementById('notice-write-view').classList.add('active');
    });
    document.getElementById('btn-cancel-notice-write').addEventListener('click', () => {
        document.getElementById('notice-write-view').classList.remove('active');
        document.getElementById('notice-write-view').style.display = 'none';
        document.getElementById('notice-list-view').style.display = 'flex'; // Restore list view
    });
    document.getElementById('btn-submit-notice').addEventListener('click', async () => {
        const title = document.getElementById('notice-title').value;
        const content = document.getElementById('notice-content').value;
        if (!title || !content) return alert('제목과 내용을 입력하세요.');

        try {
            await addDoc(collection(db, "notices"), {
                title: title,
                content: content,
                author: '관리자',
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()
            });
            alert('공지사항이 등록되었습니다.');
            document.getElementById('notice-title').value = '';
            document.getElementById('notice-content').value = '';
            document.getElementById('btn-cancel-notice-write').click();
            renderNotices();
        } catch (e) {
            console.error(e);
            alert('등록 실패');
        }
    });
}

function renderLinks() {
    const linkListEl = document.getElementById('link-list');
    if (!linkListEl) return;

    linkListEl.innerHTML = '';

    usefulLinks.forEach((link, index) => {
        const a = document.createElement('a');
        a.className = 'link-card';
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.animationDelay = `${index * 0.1}s`;

        let icon = '🔗';
        if (link.title.includes('디스코드')) icon = '💬';
        if (link.title.includes('위키')) icon = '📚';
        if (link.title.includes('갤러리') || link.title.includes('채널')) icon = '👥';

        a.innerHTML = `
            <span class="link-icon">${icon}</span>
            <span class="link-title">${link.title}</span>
        `;
        linkListEl.appendChild(a);
    });
}

// Comment Functions (Generic)
async function renderComments(entityId, listElementId) {
    const listEl = document.getElementById(listElementId);
    if (!listEl) return;

    try {
        const q = query(collection(db, "comments"), where("entityId", "==", entityId), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);

        listEl.innerHTML = '';

        if (querySnapshot.empty) {
            listEl.innerHTML = '<div style="color: #666; font-style: italic; padding: 10px;">댓글이 없습니다. 첫 번째 댓글을 남겨보세요!</div>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const comment = doc.data();
            const div = document.createElement('div');
            div.className = 'comment-item';
            const authorName = comment.author || '익명';
            const authorClass = (comment.isAdmin || authorName === '관리자') ? 'comment-author admin' : 'comment-author';
            const authorStyle = (comment.isAdmin || authorName === '관리자') ? 'color: #ff5555;' : '';

            // Use formatAuthor for consistent admin styling
            const authorHtml = (comment.isAdmin || authorName === '관리자') ? formatAuthor('관리자') : authorName;

            div.innerHTML = `
                <div class="comment-meta">
                    <span class="${authorClass}" style="${authorStyle}">${authorHtml}</span>
                    <span>${comment.date}</span>
                </div>
                <div class="comment-content">${comment.text}</div>
            `;
            listEl.appendChild(div);
        });
    } catch (error) {
        console.error("Error loading comments:", error);
        listEl.innerHTML = '<div style="color: #ff5555; padding: 10px;">댓글을 불러오는데 실패했습니다.</div>';
    }
}

async function addComment(entityId, inputId, listElementId) {
    const input = document.getElementById(inputId);
    const text = input.value.trim();

    if (!text || !entityId) return;

    try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Check if actually logged in as admin
        const realIsAdmin = isAdmin; // Use the global isAdmin flag

        await addDoc(collection(db, "comments"), {
            entityId: entityId,
            text: text,
            author: realIsAdmin ? '관리자' : '익명',
            isAdmin: realIsAdmin,
            date: new Date().toLocaleString(),
            timestamp: serverTimestamp()
        });

        input.value = '';
        renderComments(entityId, listElementId);
    } catch (error) {
        console.error("Error adding comment:", error);
        alert("댓글 등록에 실패했습니다.");
    }
}

// ====================
// Free Board Functions
// ====================

async function renderFreeBoardPosts() {
    const tbody = document.getElementById('free-board-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    try {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">등록된 게시글이 없습니다.</td></tr>';
            return;
        }

        let index = querySnapshot.size;
        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-id">${index--}</td>
                <td class="col-title">${post.title}</td>
                <td class="col-author">${formatAuthor(post.author)}</td>
                <td class="col-date">${post.date}</td>
            `;
            tr.addEventListener('click', () => viewPost(docSnap.id, post));
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading posts:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ff5555;">게시글을 불러오는데 실패했습니다.</td></tr>';
    }
}

function viewPost(id, post) {
    currentPostId = id;

    // Switch views
    document.getElementById('free-board-list-view').classList.remove('active');
    document.getElementById('free-board-write-view').classList.remove('active');
    const detailView = document.getElementById('free-board-detail-view');
    detailView.classList.add('active');

    // Populate content
    document.getElementById('post-detail-title').textContent = post.title;
    document.getElementById('post-detail-author').innerHTML = `작성자: ${formatAuthor(post.author)}`;
    document.getElementById('post-detail-date').textContent = `작성일: ${post.date}`;

    // Admin Delete Button for Free Board
    const existingDeleteBtn = document.getElementById('admin-post-delete-btn');
    if (existingDeleteBtn) existingDeleteBtn.remove();

    if (isAdmin) {
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'admin-post-delete-btn';
        deleteBtn.textContent = '글 삭제';
        deleteBtn.style.marginLeft = '15px';
        deleteBtn.style.padding = '2px 8px';
        deleteBtn.style.background = '#ff5555';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '0.8rem';

        deleteBtn.addEventListener('click', async () => {
            if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
                try {
                    await deleteDoc(doc(db, "posts", id));
                    alert('삭제되었습니다.');
                    showFreeBoardList();
                    renderFreeBoardPosts();
                } catch (error) {
                    console.error("Error deleting post:", error);
                    alert("삭제 실패");
                }
            }
        });

        document.getElementById('post-detail-date').appendChild(deleteBtn);
    }

    // Markdown parsing
    const contentHtml = marked.parse(post.content);
    document.getElementById('post-detail-content').innerHTML = contentHtml;

    renderComments(`post_${id}`, 'post-comment-list');
}

async function submitPost() {
    const author = document.getElementById('post-author').value || '익명';
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const btn = document.getElementById('btn-submit-post');

    if (!title || !content) {
        alert('제목과 내용은 필수입니다.');
        return;
    }

    btn.disabled = true;
    btn.textContent = '등록 중...';

    try {
        await addDoc(collection(db, "posts"), {
            author: author,
            title: title,
            content: content,
            date: new Date().toLocaleDateString(),
            timestamp: serverTimestamp()
        });

        // Reset form
        document.getElementById('post-author').value = '';
        document.getElementById('post-title').value = '';
        document.getElementById('post-content').value = '';

        // Go back to list
        showFreeBoardList();
        renderFreeBoardPosts(); // Refresh list
    } catch (error) {
        console.error("Error submitting post:", error);
        alert("게시글 등록에 실패했습니다.");
    } finally {
        btn.disabled = false;
        btn.textContent = '등록하기';
    }
}

function showFreeBoardList() {
    document.getElementById('free-board-list-view').classList.add('active');
    document.getElementById('free-board-write-view').classList.remove('active');
    document.getElementById('free-board-detail-view').classList.remove('active');
    currentPostId = null;
}

function showFreeBoardWriteForm() {
    document.getElementById('free-board-list-view').classList.remove('active');
    document.getElementById('free-board-write-view').classList.add('active');
    document.getElementById('free-board-detail-view').classList.remove('active');
}

function initFreeBoardEvents() {
    document.getElementById('btn-show-write-form').addEventListener('click', showFreeBoardWriteForm);
    document.getElementById('btn-cancel-write').addEventListener('click', showFreeBoardList);
    document.getElementById('btn-back-to-free-list').addEventListener('click', showFreeBoardList);
    document.getElementById('btn-submit-post').addEventListener('click', submitPost);

    document.getElementById('btn-submit-post-comment').addEventListener('click', () => {
        if (currentPostId) {
            addComment(`post_${currentPostId}`, 'post-comment-input', 'post-comment-list');
        }
    });
    document.getElementById('post-comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && currentPostId) {
            addComment(`post_${currentPostId}`, 'post-comment-input', 'post-comment-list');
        }
    });
}

// ====================
// Report Board Functions
// ====================

async function renderReportBoardPosts() {
    const tbody = document.getElementById('report-board-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    try {
        const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">제보된 내용이 없습니다.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const report = docSnap.data();
            const tr = document.createElement('tr');

            let statusIcon = '⏳';
            if (report.status === 'DONE') statusIcon = '✅';
            if (report.status === 'IN_PROGRESS') statusIcon = '🚧';

            tr.innerHTML = `
                <td class="col-id">${statusIcon}</td>
                <td class="col-title">${report.title}</td>
                <td class="col-author">${report.tag || '기타'}</td>
                <td class="col-date">${report.date}</td>
            `;
            tr.addEventListener('click', () => viewReport(docSnap.id, report));
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading reports:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ff5555;">제보 목록을 불러오는데 실패했습니다.</td></tr>';
    }
}

function viewReport(id, report) {
    currentReportId = id;

    document.getElementById('report-board-list-view').classList.remove('active');
    document.getElementById('report-board-write-view').classList.remove('active');
    const detailView = document.getElementById('report-board-detail-view');
    detailView.classList.add('active');

    let statusText = '대기 중';
    if (report.status === 'DONE') statusText = '완료됨';
    if (report.status === 'IN_PROGRESS') statusText = '처리 중';

    const statusEl = document.getElementById('report-detail-status');
    statusEl.textContent = statusText;

    // Admin Feature: Status Change
    if (isAdmin) {
        // Admin Mode Indicator
        const adminIndicator = document.createElement('span');
        adminIndicator.textContent = ' (Admin Mode)';
        adminIndicator.style.color = 'red';
        adminIndicator.style.fontSize = '0.8em';
        adminIndicator.style.marginLeft = '10px';
        if (!document.getElementById('admin-indicator')) {
            adminIndicator.id = 'admin-indicator';
            document.querySelector('.board-title').appendChild(adminIndicator);
        }

        // Status Change Buttons
        const statusContainer = document.createElement('div');
        statusContainer.style.marginTop = '10px';
        statusContainer.innerHTML = `
            <button onclick="updateReportStatus('${id}', 'WAITING')" style="margin-right:5px;">대기</button>
            <button onclick="updateReportStatus('${id}', 'IN_PROGRESS')" style="margin-right:5px;">진행중</button>
            <button onclick="updateReportStatus('${id}', 'DONE')">완료</button>
        `;
        // Remove existing if any (hacky but works for now)
        const existingStatusControls = document.getElementById('admin-status-controls');
        if (existingStatusControls) existingStatusControls.remove();

        statusContainer.id = 'admin-status-controls';
        document.getElementById('report-detail-status').appendChild(statusContainer);

        // Expose function globally for onclick
        window.updateReportStatus = async (reportId, newStatus) => {
            try {
                await updateDoc(doc(db, "reports", reportId), { status: newStatus });
                alert('상태가 변경되었습니다.');
                // Update UI immediately
                let newText = '대기 중';
                if (newStatus === 'DONE') newText = '완료됨';
                if (newStatus === 'IN_PROGRESS') newText = '처리 중';
                statusEl.childNodes[0].textContent = newText; // Keep the buttons
            } catch (e) {
                console.error(e);
                alert('상태 변경 실패');
            }
        };
    }

    statusEl.className = `status-badge status-${report.status}`;
    document.getElementById('report-detail-title').textContent = report.title;
    document.getElementById('report-detail-author').innerHTML = `작성자: ${formatAuthor(report.author)}`;
    document.getElementById('report-detail-date').textContent = `작성일: ${report.date}`;
    document.getElementById('report-detail-tag').textContent = `#${report.tag}`;

    // Image
    const imgContainer = document.getElementById('report-detail-image-container');
    const imgEl = document.getElementById('report-detail-image');
    if (report.imageUrl) {
        imgEl.src = report.imageUrl;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    // Content
    document.getElementById('report-detail-content').innerHTML = marked.parse(report.content);

    // JSON Data
    const jsonContainer = document.getElementById('report-detail-json-container');
    if (report.jsonData) {
        document.getElementById('report-detail-json').textContent = report.jsonData;
        jsonContainer.style.display = 'block';
        hljs.highlightElement(document.getElementById('report-detail-json'));
    } else {
        jsonContainer.style.display = 'none';
    }

    renderComments(`report_${id}`, 'report-comment-list');
}

async function submitReport() {
    const author = document.getElementById('report-author').value || '익명 제보자';
    const tag = document.getElementById('report-tag').value;
    const title = document.getElementById('report-title').value;
    const content = document.getElementById('report-content').value;
    const jsonData = document.getElementById('report-json').value;

    // Image upload logic would go here (omitted for simplicity as no input in HTML yet)

    if (!title || !content) {
        alert('제목과 내용은 필수입니다.');
        return;
    }

    if (!jsonData || jsonData.trim() === '') {
        alert('오류 제보 시 JSON 데이터 첨부는 필수입니다.\n지도에서 오류가 발생한 마커나 위치를 선택한 후 제보해주세요.');
        return;
    }

    try {
        await addDoc(collection(db, "reports"), {
            author: author,
            tag: tag,
            title: title,
            content: content,
            jsonData: jsonData,
            status: 'WAITING',
            date: new Date().toLocaleDateString(),
            timestamp: serverTimestamp()
        });

        alert('제보가 등록되었습니다. 감사합니다!');

        // Reset
        document.getElementById('report-title').value = '';
        document.getElementById('report-content').value = '';
        document.getElementById('report-json').value = '';
        document.getElementById('report-json-group').style.display = 'none';

        showReportBoardList();
        renderReportBoardPosts();
    } catch (error) {
        console.error("Error submitting report:", error);
        alert("제보 등록 실패");
    }
}

function showReportBoardList() {
    document.getElementById('report-board-list-view').classList.add('active');
    document.getElementById('report-board-write-view').classList.remove('active');
    document.getElementById('report-board-detail-view').classList.remove('active');
    currentReportId = null;
}

function showReportBoardWriteForm() {
    document.getElementById('report-board-list-view').classList.remove('active');
    document.getElementById('report-board-write-view').classList.add('active');
    document.getElementById('report-board-detail-view').classList.remove('active');
}

function initReportBoardEvents() {
    document.getElementById('btn-show-report-write').addEventListener('click', showReportBoardWriteForm);
    document.getElementById('btn-cancel-report').addEventListener('click', showReportBoardList);
    document.getElementById('btn-back-to-report-list').addEventListener('click', showReportBoardList);
    document.getElementById('btn-submit-report').addEventListener('click', submitReport);

    document.getElementById('btn-submit-report-comment').addEventListener('click', () => {
        if (currentReportId) {
            addComment(`report_${currentReportId}`, 'report-comment-input', 'report-comment-list');
        }
    });
    document.getElementById('report-comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && currentReportId) {
            addComment(`report_${currentReportId}`, 'report-comment-input', 'report-comment-list');
        }
    });
}

function initBoardEvents() {
    document.getElementById('btn-back-to-list').addEventListener('click', () => {
        document.getElementById('notice-detail-view').style.display = 'none';
        document.getElementById('notice-list-view').style.display = 'flex';
        currentNoticeId = null;
    });

    document.getElementById('btn-submit-comment').addEventListener('click', () => {
        if (currentNoticeId) {
            addComment(currentNoticeId, 'comment-input', 'comment-list');
        }
    });

    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && currentNoticeId) {
            addComment(currentNoticeId, 'comment-input', 'comment-list');
        }
    });
}

function initTabs() {
    const tabs = document.querySelectorAll('.board-tab');
    const contents = document.querySelectorAll('.board-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    })
}


// Helper to format author
function formatAuthor(author) {
    if (author === '관리자') {
        return `<span class="admin-text">관리자</span>`;
    }
    return author || '익명';
}
