import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { isAdmin, currentPostId, setCurrentPostId } from './state.js';
import { formatAuthor } from './utils.js';
import { renderComments, addComment } from './comments.js';

export const renderFreeBoardPosts = async () => {
    const tbody = document.getElementById('free-board-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    try {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
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
};

export const viewPost = (id, post) => {
    setCurrentPostId(id);
    document.getElementById('free-board-list-view').classList.remove('active');
    document.getElementById('free-board-write-view').classList.remove('active');
    const detailView = document.getElementById('free-board-detail-view');
    detailView.classList.add('active');
    document.getElementById('post-detail-title').textContent = post.title;
    document.getElementById('post-detail-author').innerHTML = `작성자: ${formatAuthor(post.author)}`;
    document.getElementById('post-detail-date').textContent = `작성일: ${post.date}`;
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

    const contentHtml = marked.parse(post.content);
    document.getElementById('post-detail-content').innerHTML = contentHtml;

    renderComments(`post_${id}`, 'post-comment-list');
};

export const submitPost = async () => {
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

        document.getElementById('post-author').value = '';
        document.getElementById('post-title').value = '';
        document.getElementById('post-content').value = '';

        showFreeBoardList();
        renderFreeBoardPosts();
    } catch (error) {
        console.error("Error submitting post:", error);
        alert("게시글 등록에 실패했습니다.");
    } finally {
        btn.disabled = false;
        btn.textContent = '등록하기';
    }
};

export const showFreeBoardList = () => {
    document.getElementById('free-board-list-view').classList.add('active');
    document.getElementById('free-board-write-view').classList.remove('active');
    document.getElementById('free-board-detail-view').classList.remove('active');
    setCurrentPostId(null);
};

export const showFreeBoardWriteForm = () => {
    document.getElementById('free-board-list-view').classList.remove('active');
    document.getElementById('free-board-write-view').classList.add('active');
    document.getElementById('free-board-detail-view').classList.remove('active');
};

export const initFreeBoardEvents = () => {
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
};
