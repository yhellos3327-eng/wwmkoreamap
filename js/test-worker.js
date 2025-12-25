import { webWorkerManager } from './web-worker-manager.js';

console.log("🧪 워커 매니저(WorkerManager) 테스트 시작");

const runTests = async () => {
    // 테스트 1: JSON 파싱 (DataParsingStrategy)
    console.log("👉 [테스트 1] JSON 파싱 테스트 중...");
    try {
        const jsonStr = '{"items": [{"id": 1, "name": "테스트 아이템"}]}';
        const result = await webWorkerManager.parseJSON(jsonStr);
        if (result.items && result.items[0].name === "테스트 아이템") {
            console.log("✅ [테스트 1] JSON 파싱 성공");
        } else {
            console.error("❌ [테스트 1] JSON 파싱 실패", result);
        }
    } catch (e) {
        console.error("❌ [테스트 1] 에러 발생:", e);
    }

    // 테스트 2: 카테고리 필터링 (FilteringStrategy)
    console.log("👉 [테스트 2] 카테고리 필터링 테스트 중...");
    try {
        const items = [
            { id: 1, category: 'cat1', name: '아이템 1' },
            { id: 2, category: 'cat2', name: '아이템 2' },
            { id: 3, category: 'cat1', name: '아이템 3' }
        ];
        const activeIds = new Set(['cat1']);
        const filtered = await webWorkerManager.filterByCategory(items, activeIds);

        if (filtered.length === 2 && filtered[0].id === 1 && filtered[1].id === 3) {
            console.log(`✅ [테스트 2] 필터링 성공 (결과 ${filtered.length}개)`);
        } else {
            console.error("❌ [테스트 2] 필터링 실패", filtered);
        }
    } catch (e) {
        console.error("❌ [테스트 2] 에러 발생:", e);
    }

    // 테스트 3: 검색 (FilteringStrategy)
    console.log("👉 [테스트 3] 검색 테스트 중...");
    try {
        const items = [
            { id: 1, name: '사과' },
            { id: 2, name: '바나나' },
            { id: 3, name: '파인애플' }
        ];
        const searchResult = await webWorkerManager.search(items, '바나나');

        if (searchResult.length === 1 && searchResult[0].name === '바나나') {
            console.log("✅ [테스트 3] 검색 성공");
        } else {
            console.error("❌ [테스트 3] 검색 실패", searchResult);
        }
    } catch (e) {
        console.error("❌ [테스트 3] 에러 발생:", e);
    }

    console.log("🧪 워커 매니저 테스트 완료");
};

runTests();
