// @ts-check

/**
 * @typedef {Object} MapConfig
 * @property {number} id - 지도 ID
 * @property {string} name - 지도 이름
 * @property {string} [tileUrl] - 타일 서버 URL
 * @property {string} [type] - 지도 유형 (예: 'image')
 * @property {string} [imageUrl] - 이미지 지도의 이미지 URL
 * @property {string | null} dataFile - 레거시 JSON 데이터 파일 경로
 * @property {string} newDataFile - CSV 데이터 파일 경로
 * @property {string | null} regionFile - 지역 JSON 파일 경로
 * @property {string} [crs] - CRS 유형 (예: 'Simple')
 * @property {number} minZoom - 최소 줌 레벨
 * @property {number} maxZoom - 최대 줌 레벨
 * @property {number} [maxNativeZoom] - 최대 네이티브 줌 레벨
 * @property {number[]} center - 중심 좌표 [lat, lng]
 * @property {number} zoom - 기본 줌 레벨
 * @property {number} [tilePadding] - 타일 패딩
 * @property {number[][]} [bounds] - 지도 경계 [[lat, lng], [lat, lng]]
 */

/** @type {Object.<string, MapConfig>} */
export const MAP_CONFIGS = {
  qinghe: {
    id: 3000,
    name: "청하",
    tileUrl:
      "https://ue.17173cdn.com/a/terra/tiles/yysls/3000_v4_uN4cS8/{z}/{y}_{x}.png",
    dataFile: "./data.json",
    newDataFile: "./data3.csv",
    regionFile: "./regions.json",
    minZoom: 9,
    maxZoom: 14,
    maxNativeZoom: 13,
    center: [0.6768, -0.6841],
    zoom: 11,
    tilePadding: 0.02,
  },
  dreamsunsun: {
    id: 5000,
    name: "꿈속의 불선선",
    type: "image",
    imageUrl: "./map/dreamsunsun.png",
    dataFile: null,
    newDataFile: "./data3.csv",
    regionFile: null,
    crs: "Simple",
    minZoom: -3,
    maxZoom: 2,
    center: [868, 1708.5],
    zoom: -1,
    bounds: [
      [0, 0],
      [1736, 3417],
    ],
  },
  kaifeng: {
    id: 4000,
    name: "개봉",
    tileUrl:
      "https://ue.17173cdn.com/a/terra/tiles/yysls/3003_v8_65jd2/{z}/{y}_{x}.png",
    dataFile: "./data2.json",
    newDataFile: "./data4.csv",
    regionFile: "./regions2.json",
    minZoom: 9,
    maxZoom: 14,
    maxNativeZoom: 13,
    center: [0.5, -0.5],
    zoom: 11,
    tilePadding: 1.0,
  },
};

/** @type {Object.<string, null>} */
export const ICON_MAPPING = {
  173100100592: null,
  17310013036: null,
  17310010091: null,
};

/** @type {string} */
export const BACKEND_URL = "https://api.wwmmap.kr";

/** @type {Object.<string, string>} */
export const DEFAULT_DESCRIPTIONS = {
  "달빛 금두꺼비":
    "삼족 금두꺼비는 늪과 연못에 출몰하며 달빛을 쬐면 기쁜 소리를 내고 구름이 달을 가리면 구슬픈 소리를 낸다. 삼족 금두꺼비는 재물을 모으는 힘이 있다고 전해진다. 전 왕조의 어느 한 부자가 이를 얻은 후, 재물운이 크게 좋아져 날마다 많은 재물을 쌓았고, 사람들은 이를 기이하게 여겼다.",
  "한밤의 쥐":
    "쥐를 닮은 모습으로 크고, 몸은 깨끗하며, 털은 회흑색이고, 둥근 머리와 큰 귀, 긴 수염과 늘어진 꼬리를 지녔고 성질이 교활하다. 삼경 양기가 움직일 때 출몰하며 검은 곡물을 먹을 때마다 기묘한 소리를 내며 흥겨워한다. 은밀한 곳이나 옹기 항아리 속에 숨기를 좋아한다.",
  천둥초:
    "보랏빛 둥근 꽃으로 솜털처럼 부드럽고, 크기는 대야만 하며 개화 기간이 매우 길다. 바람이 불면 천둥 소리처럼 울리고, 건드리면 폭죽 소리를 내며 흩어지며 솜털이 날린다. 맛은 달콤 쌉쌀하고 성질은 차가워 모든 경락에 들어가며 양명의 화를 식혀 설사를 멈추게 한다.",
  "고급 제비집":
    "옥빛 은실로 된 작은 잔 모양의 제비집은 높은 곳에서 제비 새끼를 품고 있다. 수십 년 전, 절벽에 갇힌 한 강호의 나그네가 제비 울음소리를 따라가 보았지만, 끝내 찾지 못했고 바람에 흔들리는 제비집만이 새 울음 같은 소리를 내며 흔들리고 있을 뿐이었다. 이후 그가 탈출한 뒤 다시 그곳을 찾아 나섰지만, 끝내 제비집을 발견하지 못했다고 한다.",
  "비범한 계수나무 가지":
    "하얗고 연한 가지가 계수나무 높은 곳에서 자라는데, 만지면 아이들이 웃는 듯한 소리가 난다. 변량에 둥근 모양의 기이한 새가 이를 물어다 둥지를 짓곤하는데, 사람을 보면 도망쳐 계수 나뭇가지만 남겨진다. 이 가지로 술을 달여 마시면 근심을 잊는다 하여 '비범한 계수나무 가지'라고 불린다.",

  "상자(지상)": "지상에 있는 보물 상자입니다.",
  "상자 (지상)": "지상에 있는 보물 상자입니다.",
  "상자(지하)": "지하에 있는 보물 상자입니다.",
  "상자 (지하)": "지하에 있는 보물 상자입니다.",

  "묘묘냥 · 인화수집":
    "일정 시간 내에 지정된 수량의 인화를 수집해 도전을 완료하고 보상을 얻으세요.",
};
