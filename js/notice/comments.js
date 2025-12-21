// notice/comments.js - 댓글 관련 기능

import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { isAdmin } from './state.js';
import { formatAuthor } from './utils.js';

export const renderComments = async (entityId, listElementId) => {
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
};

export const addComment = async (entityId, inputId, listElementId) => {
    const input = document.getElementById(inputId);
    const text = input.value.trim();

    if (!text || !entityId) return;

    try {
        const realIsAdmin = isAdmin;

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
};
