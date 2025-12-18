import { systemUpdates, translationUpdates, usefulLinks, noticeData } from './config.js';
import { db, storage } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";

let currentNoticeId = null;
let currentPostId = null;
let currentReportId = null;

document.addEventListener('DOMContentLoaded', () => {
    renderUpdateList(systemUpdates, 'system-update-list');
    renderUpdateList(translationUpdates, 'translation-update-list');
    renderLinks();
    renderNotices();
    renderFreeBoardPosts();
    renderReportBoardPosts();
    initTabs();
    initBoardEvents();
    initFreeBoardEvents();
    initReportBoardEvents();

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

function renderUpdateList(updates, elementId) {
    const listEl = document.getElementById(elementId);
    if (!listEl) return;

    listEl.innerHTML = '';

    updates.forEach((update, index) => {
        const isLatest = index === 0;
        const div = document.createElement('div');
        div.className = 'post-item';

        const contentHtml = update.content.map(line => `<li>${line}</li>`).join('');
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

function renderNotices() {
    const tbody = document.getElementById('notice-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    noticeData.forEach(notice => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-id">${notice.id}</td>
            <td class="col-title">${notice.title}</td>
            <td class="col-author">${notice.author}</td>
            <td class="col-date">${notice.date}</td>
        `;
        tr.addEventListener('click', () => viewNotice(notice.id));
        tbody.appendChild(tr);
    });
}

function viewNotice(id) {
    const notice = noticeData.find(n => n.id === id);
    if (!notice) return;

    currentNoticeId = id;

    document.getElementById('notice-list-view').style.display = 'none';
    const detailView = document.getElementById('notice-detail-view');
    detailView.style.display = 'flex';
    detailView.classList.add('active');

    document.getElementById('detail-title').textContent = notice.title;
    document.getElementById('detail-author').textContent = `작성자: ${notice.author}`;
    document.getElementById('detail-date').textContent = `작성일: ${notice.date}`;
    document.getElementById('detail-content').innerHTML = notice.content;

    renderComments(id, 'comment-list');
}

async function renderComments(entityId, listElementId) {
    const listEl = document.getElementById(listElementId);
    listEl.innerHTML = '<div style="color: #666; padding: 10px;">댓글을 불러오는 중...</div>';

    try {
        const q = query(
            collection(db, "comments"),
            where("entityId", "==", entityId),
            orderBy("timestamp", "desc")
        );

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
            div.innerHTML = `
                <div class="comment-meta">
                    <span class="comment-author">익명</span>
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
        await addDoc(collection(db, "comments"), {
            entityId: entityId,
            text: text,
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
                <td class="col-author">${post.author || '익명'}</td>
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
    document.getElementById('post-detail-author').textContent = `작성자: ${post.author || '익명'}`;
    document.getElementById('post-detail-date').textContent = `작성일: ${post.date}`;

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

    // Admin Feature: Status Change on Localhost
    if (window.location.hostname === 'localhost') {
        const existingSelect = document.getElementById('admin-status-select');
        if (existingSelect) existingSelect.remove();

        const select = document.createElement('select');
        select.id = 'admin-status-select';
        select.style.marginLeft = '10px';
        select.style.padding = '2px 5px';
        select.style.background = '#333';
        select.style.color = 'white';
        select.style.border = '1px solid #555';
        select.style.borderRadius = '4px';

        const options = [
            { val: 'WAITING', text: '대기 중' },
            { val: 'IN_PROGRESS', text: '처리 중' },
            { val: 'DONE', text: '완료됨' }
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.val;
            option.textContent = opt.text;
            if (report.status === opt.val) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            try {
                const reportRef = doc(db, "reports", id);
                await updateDoc(reportRef, { status: newStatus });

                let newStatusText = '대기 중';
                if (newStatus === 'DONE') newStatusText = '완료됨';
                if (newStatus === 'IN_PROGRESS') newStatusText = '처리 중';
                statusEl.textContent = newStatusText;

                alert(`상태가 ${newStatusText}(으)로 변경되었습니다.`);
            } catch (error) {
                console.error("Error updating status:", error);
                alert("상태 변경 실패");
            }
        });

        statusEl.parentNode.appendChild(select);
    }

    document.getElementById('report-detail-title').textContent = report.title;
    document.getElementById('report-detail-author').textContent = `작성자: ${report.author || '익명'}`;
    document.getElementById('report-detail-date').textContent = `작성일: ${report.date}`;
    document.getElementById('report-detail-tag').textContent = `#${report.tag}`;

    const contentHtml = marked.parse(report.content);
    document.getElementById('report-detail-content').innerHTML = contentHtml;

    const imgContainer = document.getElementById('report-detail-image-container');
    const img = document.getElementById('report-detail-image');
    if (report.imageUrl) {
        img.src = report.imageUrl;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    const jsonContainer = document.getElementById('report-detail-json-container');
    const jsonCode = document.getElementById('report-detail-json');
    if (report.jsonData) {
        jsonCode.textContent = report.jsonData;
        jsonContainer.style.display = 'block';
        if (window.hljs) hljs.highlightElement(jsonCode);
    } else {
        jsonContainer.style.display = 'none';
    }

    renderComments(`report_${id}`, 'report-comment-list');
}

async function submitReport() {
    const author = document.getElementById('report-author').value || '익명';
    const tag = document.getElementById('report-tag').value;
    const title = document.getElementById('report-title').value;
    let content = document.getElementById('report-content').value;
    const jsonData = document.getElementById('report-json').value;
    const btn = document.getElementById('btn-submit-report');

    if (!title || !content) {
        alert('제목과 내용은 필수입니다.');
        return;
    }

    if (jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed.latitude && parsed.longitude) {
                content += `\n\n[📍 위치 이동](index.html#x=${parsed.latitude}&y=${parsed.longitude})`;
            } else if (parsed.x && parsed.y) {
                content += `\n\n[📍 위치 이동](index.html#x=${parsed.x}&y=${parsed.y})`;
            }
        } catch (e) {
            console.log("JSON parse error", e);
        }
    }

    btn.disabled = true;
    btn.textContent = '전송 중...';

    try {
        await addDoc(collection(db, "reports"), {
            author: author,
            tag: tag,
            title: title,
            content: content,
            jsonData: jsonData || null,
            status: 'WAITING',
            date: new Date().toLocaleDateString(),
            timestamp: serverTimestamp()
        });

        document.getElementById('report-author').value = '';
        document.getElementById('report-title').value = '';
        document.getElementById('report-content').value = '';
        document.getElementById('report-json').value = '';
        document.getElementById('report-json-group').style.display = 'none';
        localStorage.removeItem('wwm_report_target');

        showReportBoardList();
        renderReportBoardPosts();
    } catch (error) {
        console.error("Error submitting report:", error);
        alert("제보 등록에 실패했습니다.");
    } finally {
        btn.disabled = false;
        btn.textContent = '제보하기';
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
    });
}
