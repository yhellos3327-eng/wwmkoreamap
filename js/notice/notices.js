import { noticeData } from '../config.js';
import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { isAdmin, currentNoticeId, setCurrentNoticeId } from './state.js';
import { formatAuthor } from './utils.js';
import { renderComments, addComment } from './comments.js';

export const renderNotices = async () => {
    const tbody = document.getElementById('notice-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    let notices = [...noticeData];

    try {
        const q = query(collection(db, "notices"), orderBy("timestamp", "desc"), limit(30));
        const querySnapshot = await getDocs(q);
        const firestoreNotices = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            firestoreNotices.push(data);
        });
        notices = [...firestoreNotices, ...notices];
    } catch (error) {
        console.error("Error loading notices:", error);
    }

    tbody.innerHTML = '';
    const totalCount = notices.length;
    notices.forEach((notice, index) => {
        const tr = document.createElement('tr');
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
};

export const viewNotice = (notice) => {
    document.getElementById('notice-list-view').style.display = 'none';
    document.getElementById('notice-write-view').style.display = 'none';
    const detailView = document.getElementById('notice-detail-view');
    detailView.style.display = 'block';
    detailView.classList.add('active');

    document.getElementById('detail-title').textContent = notice.title;
    document.getElementById('detail-author').innerHTML = `작성자: ${formatAuthor(notice.author)}`;
    document.getElementById('detail-date').textContent = `작성일: ${notice.date}`;
    document.getElementById('detail-content').innerHTML = marked.parse(notice.content);

    const existingDeleteBtn = document.getElementById('admin-notice-delete-btn');
    if (existingDeleteBtn) existingDeleteBtn.remove();

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

    const entityId = (typeof notice.id === 'string' && notice.id.length > 5) ? `notice_${notice.id}` : `notice_static_${notice.id}`;
    setCurrentNoticeId(entityId);
    renderComments(entityId, 'comment-list');
};

export const initNoticeEvents = () => {
    document.getElementById('btn-show-notice-write').addEventListener('click', () => {
        document.getElementById('notice-list-view').style.display = 'none';
        document.getElementById('notice-detail-view').style.display = 'none';
        document.getElementById('notice-write-view').style.display = 'block';
        document.getElementById('notice-write-view').classList.add('active');
    });

    document.getElementById('btn-cancel-notice-write').addEventListener('click', () => {
        document.getElementById('notice-write-view').classList.remove('active');
        document.getElementById('notice-write-view').style.display = 'none';
        document.getElementById('notice-list-view').style.display = 'block';
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
};

export const initBoardEvents = () => {
    document.getElementById('btn-back-to-list').addEventListener('click', () => {
        document.getElementById('notice-detail-view').style.display = 'none';
        document.getElementById('notice-list-view').style.display = 'block';
        setCurrentNoticeId(null);
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
};
