/**
 * 백업 데이터 저장
 */
export const saveBackup = () => {
    try {
        const data = { ...localStorage };
        if (Object.keys(data).length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const fileName = `map_data_backup_${dateStr}.json`;
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error('백업 실패:', err);
        alert('데이터 저장 중 오류가 발생했습니다.');
    }
};

/**
 * 백업 파일 로드 및 복구
 */
export const loadBackup = (file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const fileContent = event.target.result;
            const parsedData = JSON.parse(fileContent);
            if (typeof parsedData !== 'object' || parsedData === null) {
                throw new Error('잘못된 JSON 형식');
            }
            localStorage.clear();
            for (const key in parsedData) {
                if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
                    localStorage.setItem(key, parsedData[key]);
                }
            }

            alert('✅ 데이터 복구가 완료되었습니다.\n적용을 위해 페이지를 새로고침합니다.');
            location.reload();

        } catch (err) {
            console.error('복구 실패:', err);
            alert('파일을 읽는 데 실패했습니다. 올바른 백업 파일인지 확인해 주세요.');
        }
    };
    reader.readAsText(file);
};

/**
 * 백업 버튼 초기화
 */
export const initBackupButtons = () => {
    const saveBtn = document.getElementById('btn-backup-save');
    const loadBtn = document.getElementById('btn-backup-load');
    const fileInput = document.getElementById('inp-backup-file');

    if (!saveBtn || !loadBtn || !fileInput) return;

    saveBtn.addEventListener('click', saveBackup);

    loadBtn.addEventListener('click', () => {
        if (confirm('⚠️ 주의!\n파일을 불러오면 현재 저장된 지도의 마커나 설정이 모두 사라지고 파일의 내용으로 교체됩니다.\n계속하시겠습니까?')) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        loadBackup(e.target.files[0]);
        e.target.value = '';
    });
};
