// notice/reports.js - 신고/제보 게시판 관련 기능

import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { isAdmin, currentReportId, setCurrentReportId } from './state.js';
import { formatAuthor } from './utils.js';
import { renderComments, addComment } from './comments.js';

export const renderReportBoardPosts = async () => {
    const tbody = document.getElementById('report-board-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">로딩 중...</td></tr>';

    try {
        const q = query(collection(db, "reports"), orderBy("timestamp", "desc"), limit(50));
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
};

export const viewReport = (id, report) => {
    setCurrentReportId(id);

    document.getElementById('report-board-list-view').classList.remove('active');
    document.getElementById('report-board-write-view').classList.remove('active');
    const detailView = document.getElementById('report-board-detail-view');
    detailView.classList.add('active');

    let statusText = '대기 중';
    let statusClass = 'WAITING';
    if (report.status === 'DONE') {
        statusText = '완료됨';
        statusClass = 'DONE';
    }
    if (report.status === 'IN_PROGRESS') {
        statusText = '처리 중';
        statusClass = 'IN_PROGRESS';
    }

    const statusEl = document.getElementById('report-detail-status');
    statusEl.textContent = statusText;
    statusEl.className = `status-badge status-${statusClass}`;

    // 기존 관리자 컨트롤 제거
    const existingStatusControls = document.getElementById('admin-status-controls');
    if (existingStatusControls) existingStatusControls.remove();

    if (isAdmin) {
        const adminIndicator = document.createElement('span');
        adminIndicator.textContent = ' (Admin Mode)';
        adminIndicator.style.color = 'red';
        adminIndicator.style.fontSize = '0.8em';
        adminIndicator.style.marginLeft = '10px';
        if (!document.getElementById('admin-indicator')) {
            adminIndicator.id = 'admin-indicator';
            document.querySelector('.board-title').appendChild(adminIndicator);
        }

        // 관리자 상태 컨트롤을 statusEl의 부모(detail-title)에 추가
        const statusContainer = document.createElement('div');
        statusContainer.id = 'admin-status-controls';
        statusContainer.innerHTML = `
            <button data-status="WAITING">⏳ 대기</button>
            <button data-status="IN_PROGRESS">🚧 진행중</button>
            <button data-status="DONE">✅ 완료</button>
        `;

        // 버튼 이벤트 바인딩
        statusContainer.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = btn.dataset.status;
                try {
                    await updateDoc(doc(db, "reports", id), { status: newStatus });
                    alert('상태가 변경되었습니다.');
                    let newText = '대기 중';
                    let newClass = 'WAITING';
                    if (newStatus === 'DONE') { newText = '완료됨'; newClass = 'DONE'; }
                    if (newStatus === 'IN_PROGRESS') { newText = '처리 중'; newClass = 'IN_PROGRESS'; }
                    statusEl.textContent = newText;
                    statusEl.className = `status-badge status-${newClass}`;
                } catch (e) {
                    console.error(e);
                    alert('상태 변경 실패');
                }
            });
        });

        // statusEl의 부모 요소 뒤에 추가
        statusEl.parentNode.insertBefore(statusContainer, statusEl.nextSibling);
    }

    document.getElementById('report-detail-title').textContent = report.title;
    document.getElementById('report-detail-author').innerHTML = `작성자: ${formatAuthor(report.author)}`;
    document.getElementById('report-detail-date').textContent = `작성일: ${report.date}`;
    document.getElementById('report-detail-tag').textContent = `#${report.tag}`;

    const imgContainer = document.getElementById('report-detail-image-container');
    const imgEl = document.getElementById('report-detail-image');
    if (report.imageUrl) {
        imgEl.src = report.imageUrl;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    document.getElementById('report-detail-content').innerHTML = marked.parse(report.content);

    const jsonContainer = document.getElementById('report-detail-json-container');
    if (report.jsonData) {
        const jsonEl = document.getElementById('report-detail-json');
        jsonEl.textContent = report.jsonData;
        delete jsonEl.dataset.highlighted;
        jsonContainer.style.display = 'block';
        hljs.highlightElement(jsonEl);
    } else {
        jsonContainer.style.display = 'none';
    }

    renderComments(`report_${id}`, 'report-comment-list');

    // 맵 뷰어 처리
    const mapContainer = document.getElementById('report-map-container');
    const btnViewMap = document.getElementById('btn-view-map');
    const mapModal = document.getElementById('map-modal');
    const mapFrame = document.getElementById('map-frame');
    const btnCloseMap = document.getElementById('btn-close-map');

    // 초기화
    mapContainer.style.display = 'none';

    // 이벤트 리스너 중복 방지를 위해 새로 복제 (간단한 방법)
    const newBtn = btnViewMap.cloneNode(true);
    btnViewMap.parentNode.replaceChild(newBtn, btnViewMap);

    // 모달 닫기 이벤트 (한 번만 등록하면 되지만 여기서는 안전하게 처리)
    btnCloseMap.onclick = () => {
        mapModal.style.display = 'none';
        mapFrame.src = '';
    };

    mapModal.onclick = (e) => {
        if (e.target === mapModal) {
            mapModal.style.display = 'none';
            mapFrame.src = '';
        }
    };

    if (report.jsonData) {
        try {
            const data = JSON.parse(report.jsonData);
            // lat, lng가 있거나 id가 있는 경우
            if ((data.lat && data.lng) || data.id) {
                mapContainer.style.display = 'block';

                newBtn.onclick = async () => {
                    const params = new URLSearchParams();
                    params.append('embed', 'true');
                    if (data.id) params.append('id', data.id);
                    if (data.lat) params.append('lat', data.lat);
                    if (data.lng) params.append('lng', data.lng);

                    let mapKey = data.map;

                    // mapId로 확인
                    if (!mapKey) {
                        if (data.mapId == 3000 || data.map_id == 3000) mapKey = 'qinghe';
                        else if (data.mapId == 3003 || data.map_id == 3003) mapKey = 'kaifeng';
                    }

                    // ID로 데이터 파일 조회하여 확인
                    if (!mapKey && data.id) {
                        const originalText = newBtn.textContent;
                        newBtn.disabled = true;
                        newBtn.textContent = '위치 확인 중...';
                        try {
                            const checkMap = async (url, targetMapKey) => {
                                try {
                                    const res = await fetch(url);
                                    const json = await res.json();
                                    const found = json.data.find(item => String(item.id) === String(data.id));
                                    return found ? targetMapKey : null;
                                } catch (e) {
                                    console.error(`Error fetching ${url}:`, e);
                                    return null;
                                }
                            };

                            // 청하 데이터 확인
                            mapKey = await checkMap('data.json', 'qinghe');

                            // 없으면 개봉 데이터 확인
                            if (!mapKey) {
                                mapKey = await checkMap('data2.json', 'kaifeng');
                            }
                        } catch (e) {
                            console.error("Error checking map data:", e);
                        } finally {
                            newBtn.disabled = false;
                            newBtn.textContent = originalText;
                        }
                    }

                    if (mapKey) {
                        params.append('map', mapKey);
                    }

                    mapFrame.src = 'index.html?' + params.toString();
                    mapModal.style.display = 'flex';
                };
            }
        } catch (e) {
            console.error("JSON parsing error for map viewer:", e);
        }
    }
};

export const submitReport = async () => {
    const author = document.getElementById('report-author').value || '익명 제보자';
    const tag = document.getElementById('report-tag').value;
    const title = document.getElementById('report-title').value;
    const content = document.getElementById('report-content').value;
    const jsonData = document.getElementById('report-json').value;

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
};

export const showReportBoardList = () => {
    document.getElementById('report-board-list-view').classList.add('active');
    document.getElementById('report-board-write-view').classList.remove('active');
    document.getElementById('report-board-detail-view').classList.remove('active');
    setCurrentReportId(null);
};

export const showReportBoardWriteForm = () => {
    document.getElementById('report-board-list-view').classList.remove('active');
    document.getElementById('report-board-write-view').classList.add('active');
    document.getElementById('report-board-detail-view').classList.remove('active');
};

export const initReportBoardEvents = () => {
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
};
