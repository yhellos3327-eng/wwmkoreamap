import { DISCORD_WEBHOOK_URL, DISCORD_SERVER_ID, DISCORD_CHANNEL_ID, DISCORD_TAGS } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const jsonDataTextarea = document.getElementById('json-data');
    const imageInput = document.getElementById('image-file');
    const previewImage = document.getElementById('preview-image');
    const submitBtn = document.getElementById('btn-submit');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const nicknameInput = document.getElementById('nickname');
    const tagSelect = document.getElementById('tag-select');
    const boardContainer = document.getElementById('board-container');

    const loadBoard = () => {
        boardContainer.innerHTML = '';
        if (DISCORD_SERVER_ID && DISCORD_CHANNEL_ID) {
            const iframe = document.createElement('iframe');
            iframe.src = `https://e.widgetbot.io/channels/${DISCORD_SERVER_ID}/${DISCORD_CHANNEL_ID}`;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.allow = "clipboard-write; fullscreen";
            boardContainer.appendChild(iframe);
        } else {
            boardContainer.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">게시판 설정이 완료되지 않았습니다.</p>';
        }
    };

    loadBoard();

    let validReportData = null;
    const reportTarget = localStorage.getItem('wwm_report_target');
    if (reportTarget) {
        try {
            const parsed = JSON.parse(reportTarget);
            validReportData = JSON.stringify(parsed, null, 4);
            jsonDataTextarea.value = validReportData;
            if (parsed.name) {
                titleInput.value = `[오류 제보] ${parsed.name}`;
            }
        } catch (e) {
            validReportData = reportTarget;
            jsonDataTextarea.value = validReportData;
        }
    } else {
        jsonDataTextarea.value = "데이터 없음";
    }

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewImage.style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
        } else {
            previewImage.style.display = 'none';
            previewImage.src = '';
        }
    });

    submitBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const selectedTagKey = tagSelect ? tagSelect.value : null;

        if (!title) {
            alert("제목을 입력해주세요.");
            titleInput.focus();
            return;
        }
        if (!content) {
            alert("내용을 입력해주세요.");
            contentInput.focus();
            return;
        }

        if (!validReportData) {
            alert("데이터가 없어 게시글을 작성할 수 없습니다. (잘못된 접근)");
            return;
        }

        if (!DISCORD_WEBHOOK_URL) {
            alert("관리자 설정 오류: 디스코드 웹훅 URL이 설정되지 않았습니다.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "전송 중...";

        const formData = new FormData();

        const payload = {
            content: `## 내용\n${content}\n## 데이터\n\`\`\`json\n${validReportData}\n\`\`\``,
            username: nicknameInput.value.trim() || '익명 제보자',
            thread_name: title,
            applied_tags: []
        };

        if (selectedTagKey && DISCORD_TAGS && DISCORD_TAGS[selectedTagKey]) {
            payload.applied_tags.push(DISCORD_TAGS[selectedTagKey]);
        }

        formData.append('payload_json', JSON.stringify(payload));

        if (imageInput.files[0]) {
            formData.append('file', imageInput.files[0]);
        }

        try {
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert("게시글이 등록되었습니다!");
                localStorage.removeItem('wwm_report_target');

                titleInput.value = '';
                contentInput.value = '';
                imageInput.value = '';
                previewImage.style.display = 'none';
                jsonDataTextarea.value = '데이터 없음';
                validReportData = null;
                submitBtn.disabled = false;
                submitBtn.textContent = "게시글 작성";

                // Refresh board after delay
                setTimeout(() => {
                    loadBoard();
                }, 5000);

            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
            submitBtn.disabled = false;
            submitBtn.textContent = "게시글 작성";
        }
    });
});
