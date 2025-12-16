export const updateHistory = [
    {
        version: "v1.2.9",
        date: "2025-12-16",
        content: [
            "첫 방문시 가이드 추가.",
            "옵션 모달 내 다양한 옵션 추가.",
            "청하 일부 지역 번역 데이터 추가.",
            "디버그 모드 개선.",
            "구조 및 코드 최적화.",
            "번역 데이터 JSON 에서 CSV로 변경.",
            "기여 페이지 개선, 번역 기여 원할경우 기여 페이지 (깃허브 버튼) 참조."
        ]
    },
    {
        version: "v1.2.8",
        date: "2025-12-10",
        content: [
            "디자인 개선",
            "광고 토글 추가 (광고 없음)",
            "버그 수정"
        ]
    },
    {
        version: "v1.2.7",
        date: "2025-12-09",
        content: [
            "버그 수정: 마커가 외딴 좌표에서 날아오는 애니메이션 글리치 해결",
        ]
    },
    {
        version: "v1.2.5",
        date: "2025-12-09",
        content: [
            "지도 최적화.",
            "개봉 추가"
        ]
    },
    {
        version: "v1.2",
        date: "2025-12-08",
        content: [
            "지역 경계선 표시 및 동영상 재생 기능 추가.",
            "청하 경계석 100% 한글화. (경계석 설명도 추가됨.)",
            "기술 습득 카테고리 번역중."
        ]
    },
    {
        version: "v1.1",
        date: "2025-12-08",
        content: [
            "AI 번역 기능: 설명이 없는 항목은 번역 버튼 제외",
            "초기 로딩 시 경계석만 활성화",
        ]
    },
    {
        version: "v1.0.6",
        date: "2025-12-08",
        content: [
            "중국 지도 기반으로 업데이트, 데이터가 변경된 부분들이 매우 많아 다시 번역중입니다. 많이 더뎌질수 있습니다. 그래도 기존 번역 데이터가 있기에 조금 수월할것 같습니다. 여러분들 미안합니다.. 빠르게 번역해보도록 하겠습니다.",
        ]
    },
    {
        version: "v1.0.5",
        date: "2025-12-06",
        content: [
            "청하 지역 상기, 제작대, 천공 동굴 한글화.",
        ]
    },
    {
        version: "v1.0.4",
        date: "2025-12-05",
        content: [
            "궁술 대결, 퇴마의 종, 현상금 한글화.",
        ]
    },
    {
        version: "v1.0.3",
        date: "2025-12-05",
        content: [
            "카테고리 한글화 (인게임 용어로)",
            "청하 지역 경계석, 천애객 한글화 (인게임 용어로)",
        ]
    },
    {
        version: "v1.0.2",
        date: "2025-12-05",
        content: [
            "지도 렌더링 최적화",
            "데이터 로딩 구조 개선",
        ]
    },
    { version: "v1.0.1", date: "2025-12-05", content: ["지역별 필터링 추가", "일괄 토글 버튼 추가"] },
    { version: "v1.0.0", date: "2025-12-05", content: ["한국어 지도 오픈"] }
];

export const usefulLinks = [
    { title: "공식 홈페이지", url: "https://www.wherewindsmeetgame.com/kr/index.html" },
    { title: "기반 위키 (Wiki)", url: "https://wherewindsmeet.wiki.fextralife.com/" },
    { title: "연운: 한국 위키", url: "https://wwm.tips/" },
    { title: "연운 공식 디스코드", url: "https://discord.gg/wherewindsmeet" },
    { title: "연운 한국 디스코드", url: "https://discord.gg/wherewindsmeetkr" },
    { title: "아카라이브 연운 채널", url: "https://arca.live/b/wherewindsmeet" },
    { title: "디씨 연운 갤러리", url: "https://gall.dcinside.com/wherewindsmeets" },
    { title: "디씨 개봉(연운) 갤러리", url: "https://gall.dcinside.com/dusdns" },
];

export const contributionLinks = [
    { titleKey: "github_repository", url: "https://github.com/yhellos3327-eng/wwmkoreamap", icon: "code" },
    { titleKey: "data_submission", url: "https://github.com/yhellos3327-eng/wwmkoreamap/issues", icon: "bug" },
];

export const MAP_CONFIGS = {
    qinghe: {
        id: 3000,
        name: "청하 (清河)",
        tileUrl: 'https://ue.17173cdn.com/a/terra/tiles/yysls/3000_v4_uN4cS8/{z}/{y}_{x}.png',
        dataFile: './data.json',
        regionFile: './regions.json',
        minZoom: 9,
        maxZoom: 13,
        center: [0.6768, -0.6841],
        zoom: 11,
        tilePadding: 0.02
    },
    kaifeng: {
        id: 4000,
        name: "개봉 (开封)",
        tileUrl: 'https://ue.17173cdn.com/a/terra/tiles/yysls/3003_v8_65jd2/{z}/{y}_{x}.png',
        dataFile: './data2.json',
        regionFile: './regions2.json',
        minZoom: 9,
        maxZoom: 13,
        center: [0.5, -0.5],
        zoom: 11,
        tilePadding: 1.0
    }
};

export const ICON_MAPPING = {
    "173100100592": null,
    "17310013036": null,
    "17310010091": null,
};

export const guideSteps = [
    {
        element: '#sidebar',
        title: '사이드바 메뉴',
        content: '여기서 카테고리, 지역, 즐겨찾기 등을 선택하여 지도에 표시할 항목을 필터링할 수 있습니다.',
        position: 'right'
    },
    {
        element: '.map-selector-wrapper',
        title: '지도 변경',
        content: '청하, 개봉 등 다른 지역의 지도로 변경할 수 있습니다.',
        position: 'bottom'
    },
    {
        element: '#search-input',
        title: '검색',
        content: '원하는 아이템이나 지역을 빠르게 검색하세요.',
        position: 'bottom'
    },
    {
        element: '#map',
        title: '지도 이동 및 확대와 마커 시스템',
        content: '지도를 드래그하여 이동하고, 마우스 휠로 확대/축소할 수 있습니다. 우클릭하면 해당 지역만 필터링할 수 있습니다. 또한 지도상의 아이콘(마커)을 클릭하면 상세 정보를 볼 수 있습니다. 마커를 우클릭하면 "완료" 상태로 표시하여 숨길 수 있습니다.',
        position: 'center'
    },
    {
        element: '.leaflet-control-zoom',
        title: '줌 컨트롤',
        content: '버튼을 클릭하여 지도를 확대하거나 축소할 수도 있습니다.',
        position: 'left'
    },
    {
        element: '#open-settings',
        title: '설정',
        content: 'API 키 설정, 데이터 백업/복구, 화면 설정을 할 수 있습니다.',
        position: 'bottom'
    },
    {
        element: '#open-github-modal',
        title: '기여하기',
        content: '오류 제보나 번역 데이터 수정에 참여할 수 있습니다.',
        position: 'bottom'
    },
    {
        element: '.translation-progress-container',
        title: '한글화 진행도',
        content: '현재 지도의 한글화 진행 상황을 확인할 수 있습니다.',
        position: 'right'
    }
];
