import { state, subscribe, dispatch, setDeep, setState } from './state.js';
import { ACTIONS } from './actions.js';

console.log("🧪 상태 관리 테스트 시작");

subscribe('currentMapKey', (val) => {
    console.log(`✅ [테스트 1] currentMapKey 변경됨: ${val}`);
});

console.log("👉 SET_MAP 액션 디스패치 중...");
dispatch(ACTIONS.SET_MAP, 'kaifeng');

subscribe('mapData', (val) => {
    console.log(`✅ [테스트 2] mapData 변경됨 (루트 알림)`);
});

console.log("👉 깊은 값 mapData.items 설정 중...");
setDeep('mapData.items', [{ id: 999, name: '테스트 아이템' }]);

if (state.mapData.items[0].id === 999) {
    console.log("✅ [테스트 2] 깊은 업데이트 성공: state.mapData.items[0].id 는 999 입니다.");
} else {
    console.error("❌ [테스트 2] 깊은 업데이트 실패");
}

subscribe('activeCategoryIds', (val) => {
    console.log(`✅ [테스트 3] activeCategoryIds 변경됨. 크기: ${val.size}`);
});

console.log("👉 UPDATE_FILTER (추가) 디스패치 중...");
dispatch(ACTIONS.UPDATE_FILTER, { type: 'category', id: 'cat1', active: true });

if (state.activeCategoryIds.has('cat1')) {
    console.log("✅ [테스트 3] 필터 업데이트 성공: cat1 추가됨");
} else {
    console.error("❌ [테스트 3] 필터 업데이트 실패");
}

console.log("🧪 상태 관리 테스트 완료");
