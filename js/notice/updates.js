// notice/updates.js - 시스템/번역 업데이트 관련 기능

import { systemUpdates, translationUpdates } from '../config.js';
import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { isAdmin, editingSystemUpdateId, editingTranslationUpdateId, setEditingSystemUpdateId, setEditingTranslationUpdateId } from './state.js';

export const renderSystemUpdates = async () => {
    const listEl = document.getElementById('system-update-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="post-item" style="text-align: center; padding: 40px; color: #666;">로딩 중...</div>';

    let updates = [...systemUpdates];

    try {
        const q = query(collection(db, "system_updates"), orderBy("timestamp", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        const firestoreUpdates = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            firestoreUpdates.push(data);
        });
        updates = [...firestoreUpdates, ...updates];
    } catch (error) {
        console.error("Error loading system updates:", error);
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

        if (isAdmin && update.id) {
            const adminDiv = document.createElement('div');
            adminDiv.style.marginTop = '10px';
            adminDiv.style.borderTop = '1px solid #444';
            adminDiv.style.paddingTop = '10px';
            adminDiv.style.textAlign = 'right';

            const editBtn = document.createElement('button');
            editBtn.textContent = '수정';
            editBtn.className = 'btn-list';
            editBtn.style.marginRight = '5px';
            editBtn.onclick = () => {
                setEditingSystemUpdateId(update.id);
                document.getElementById('system-version').value = update.version;
                let contentText = '';
                if (Array.isArray(update.content)) {
                    contentText = update.content.join('\n');
                } else {
                    contentText = update.content;
                }
                document.getElementById('system-content').value = contentText;

                document.getElementById('system-update-list-view').classList.remove('active');
                document.getElementById('system-update-write-view').classList.add('active');
                document.getElementById('btn-submit-system-update').textContent = '수정하기';
                document.querySelector('#system-update-write-view h3').textContent = '시스템 업데이트 수정';
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '삭제';
            deleteBtn.className = 'btn-list';
            deleteBtn.style.background = '#ff5555';
            deleteBtn.style.border = 'none';
            deleteBtn.style.color = 'white';
            deleteBtn.onclick = async () => {
                if (confirm('정말로 삭제하시겠습니까?')) {
                    try {
                        await deleteDoc(doc(db, "system_updates", update.id));
                        alert('삭제되었습니다.');
                        renderSystemUpdates();
                    } catch (e) {
                        console.error(e);
                        alert('삭제 실패');
                    }
                }
            };

            adminDiv.appendChild(editBtn);
            adminDiv.appendChild(deleteBtn);
            div.appendChild(adminDiv);
        }
        listEl.appendChild(div);
    });
};

export const renderTranslationUpdates = async () => {
    const listEl = document.getElementById('translation-update-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="post-item" style="text-align: center; padding: 40px; color: #666;">로딩 중...</div>';

    let updates = [...translationUpdates];

    try {
        const q = query(collection(db, "translation_updates"), orderBy("timestamp", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        const firestoreUpdates = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            firestoreUpdates.push(data);
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

        if (isAdmin && update.id) {
            const adminDiv = document.createElement('div');
            adminDiv.style.marginTop = '10px';
            adminDiv.style.borderTop = '1px solid #444';
            adminDiv.style.paddingTop = '10px';
            adminDiv.style.textAlign = 'right';

            const editBtn = document.createElement('button');
            editBtn.textContent = '수정';
            editBtn.className = 'btn-list';
            editBtn.style.marginRight = '5px';
            editBtn.onclick = () => {
                setEditingTranslationUpdateId(update.id);
                document.getElementById('translation-version').value = update.version;

                let contentText = '';
                if (Array.isArray(update.content)) {
                    contentText = update.content.join('\n');
                } else {
                    contentText = update.content;
                }
                document.getElementById('translation-content').value = contentText;

                document.getElementById('translation-update-list-view').classList.remove('active');
                document.getElementById('translation-update-write-view').classList.add('active');
                document.getElementById('btn-submit-translation-update').textContent = '수정하기';
                document.querySelector('#translation-update-write-view h3').textContent = '번역 업데이트 수정';
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '삭제';
            deleteBtn.className = 'btn-list';
            deleteBtn.style.background = '#ff5555';
            deleteBtn.style.border = 'none';
            deleteBtn.style.color = 'white';
            deleteBtn.onclick = async () => {
                if (confirm('정말로 삭제하시겠습니까?')) {
                    try {
                        await deleteDoc(doc(db, "translation_updates", update.id));
                        alert('삭제되었습니다.');
                        renderTranslationUpdates();
                    } catch (e) {
                        console.error(e);
                        alert('삭제 실패');
                    }
                }
            };

            adminDiv.appendChild(editBtn);
            adminDiv.appendChild(deleteBtn);
            div.appendChild(adminDiv);
        }
        listEl.appendChild(div);
    });
};

export const initUpdateEvents = () => {
    document.getElementById('btn-show-system-write').addEventListener('click', () => {
        setEditingSystemUpdateId(null);
        document.getElementById('system-version').value = '';
        document.getElementById('system-content').value = '';
        document.getElementById('btn-submit-system-update').textContent = '등록하기';
        document.querySelector('#system-update-write-view h3').textContent = '시스템 업데이트 작성';

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
            if (editingSystemUpdateId) {
                await updateDoc(doc(db, "system_updates", editingSystemUpdateId), {
                    version: version,
                    content: content
                });
                alert('업데이트가 수정되었습니다.');
            } else {
                await addDoc(collection(db, "system_updates"), {
                    version: version,
                    content: content,
                    date: new Date().toLocaleDateString(),
                    timestamp: serverTimestamp()
                });
                alert('업데이트가 등록되었습니다.');
            }

            document.getElementById('system-version').value = '';
            document.getElementById('system-content').value = '';
            document.getElementById('btn-cancel-system-write').click();
            renderSystemUpdates();
        } catch (e) {
            console.error(e);
            alert('작업 실패');
        }
    });

    document.getElementById('btn-show-translation-write').addEventListener('click', () => {
        setEditingTranslationUpdateId(null);
        document.getElementById('translation-version').value = '';
        document.getElementById('translation-content').value = '';
        document.getElementById('btn-submit-translation-update').textContent = '등록하기';
        document.querySelector('#translation-update-write-view h3').textContent = '번역 업데이트 작성';

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
            if (editingTranslationUpdateId) {
                await updateDoc(doc(db, "translation_updates", editingTranslationUpdateId), {
                    version: version,
                    content: content
                });
                alert('업데이트가 수정되었습니다.');
            } else {
                await addDoc(collection(db, "translation_updates"), {
                    version: version,
                    content: content,
                    date: new Date().toLocaleDateString(),
                    timestamp: serverTimestamp()
                });
                alert('업데이트가 등록되었습니다.');
            }

            document.getElementById('translation-version').value = '';
            document.getElementById('translation-content').value = '';
            document.getElementById('btn-cancel-translation-write').click();
            renderTranslationUpdates();
        } catch (e) {
            console.error(e);
            alert('작업 실패');
        }
    });
};
