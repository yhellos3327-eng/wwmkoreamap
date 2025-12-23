// notice/comments.js - 댓글 관련 기능

import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
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

        querySnapshot.forEach((docSnap) => {
            const comment = docSnap.data();
            const commentId = docSnap.id;
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.id = `comment-${commentId}`;

            const authorName = comment.author || '익명';
            const authorClass = (comment.isAdmin || authorName === '관리자') ? 'comment-author admin' : 'comment-author';
            const authorStyle = (comment.isAdmin || authorName === '관리자') ? 'color: #ff5555;' : '';
            const authorHtml = (comment.isAdmin || authorName === '관리자') ? formatAuthor('관리자') : authorName;

            let buttonsHtml = '';
            if (isAdmin) {
                buttonsHtml = `
                    <div class="comment-actions" style="margin-left: auto; font-size: 0.8rem;">
                        <button class="btn-edit-comment" data-id="${commentId}" style="margin-right: 5px; cursor: pointer; border: none; background: none; color: #aaa;">✏️</button>
                        <button class="btn-delete-comment" data-id="${commentId}" style="cursor: pointer; border: none; background: none; color: #ff5555;">🗑️</button>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="comment-header" style="display: flex; align-items: center; margin-bottom: 5px;">
                    <div class="comment-meta">
                        <span class="${authorClass}" style="${authorStyle}">${authorHtml}</span>
                        <span style="margin-left: 10px; color: #888; font-size: 0.8rem;">${comment.date}</span>
                    </div>
                    ${buttonsHtml}
                </div>
                <div class="comment-content" id="content-${commentId}">${comment.text}</div>
                <div class="comment-edit-form" id="edit-form-${commentId}" style="display: none; margin-top: 5px;">
                    <textarea class="edit-input" id="edit-input-${commentId}" style="width: 100%; padding: 5px; border-radius: 4px; border: 1px solid #444; background: #333; color: #fff; margin-bottom: 5px; min-height: 60px;">${comment.text}</textarea>
                    <div style="text-align: right;">
                        <button class="btn-save-comment" data-id="${commentId}" style="padding: 4px 12px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px; margin-right: 5px;">저장</button>
                        <button class="btn-cancel-edit" data-id="${commentId}" style="padding: 4px 12px; cursor: pointer; background: #666; color: white; border: none; border-radius: 4px;">취소</button>
                    </div>
                </div>
            `;
            listEl.appendChild(div);
        });

        // Add event listeners for buttons
        if (isAdmin) {
            listEl.querySelectorAll('.btn-delete-comment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('button').dataset.id;
                    deleteComment(id, entityId, listElementId);
                });
            });

            listEl.querySelectorAll('.btn-edit-comment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('button').dataset.id;
                    document.getElementById(`content-${id}`).style.display = 'none';
                    document.getElementById(`edit-form-${id}`).style.display = 'block';
                });
            });

            listEl.querySelectorAll('.btn-cancel-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    document.getElementById(`content-${id}`).style.display = 'block';
                    document.getElementById(`edit-form-${id}`).style.display = 'none';
                });
            });

            listEl.querySelectorAll('.btn-save-comment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const newText = document.getElementById(`edit-input-${id}`).value;
                    updateComment(id, newText, entityId, listElementId);
                });
            });
        }

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

export const deleteComment = async (commentId, entityId, listElementId) => {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
        await deleteDoc(doc(db, "comments", commentId));
        renderComments(entityId, listElementId);
    } catch (error) {
        console.error("Error deleting comment:", error);
        alert("댓글 삭제 실패: " + error.message);
    }
};

export const updateComment = async (commentId, newText, entityId, listElementId) => {
    if (!newText.trim()) return alert('내용을 입력하세요.');

    try {
        await updateDoc(doc(db, "comments", commentId), {
            text: newText
        });
        renderComments(entityId, listElementId);
    } catch (error) {
        console.error("Error updating comment:", error);
        alert("댓글 수정 실패: " + error.message);
    }
};
