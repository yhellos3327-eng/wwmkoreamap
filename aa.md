Context
백업 깜빡임, 커뮤니티 마커 버그, 스크린샷 다중 이미지, BGM 플레이어 추가.
커뮤니티+네이티브 통합 및 사이드바 UI/UX 대폭 개선은 별도 세션에서 진행.

Part 1: Backup Flicker Fix
파일: js/settings/backup.js

loadCloudBackups() (line 294): _loadingPromise guard로 중복 호출 방지
refreshCloudBackupVisibility() (line 319): await loadCloudBackups() 후 display: "block" (빈 상태 flash 제거)


Part 2: BGM Player (사이드바 하단)
새 파일 3개
파일역할js/bgm/player.jsYouTube IFrame API wrapper, PLAYLIST 배열, 재생 제어js/bgm/ui.jsaudio-bar DOM 생성, 이벤트 바인딩, initBgmPlayer() exportcss/sidebar/audio-bar.css64px 바, sidebar 하단 고정, 테마 변수 사용
기존 파일 수정

css/sidebar.css: @import 'sidebar/audio-bar.css'; 추가
js/events.js: initAllEventHandlers()에 initBgmPlayer() 호출 추가

구현 상세

YouTube IFrame API: hidden div(0x0), audio-only 재생
DOM: progress bar + track title + prev/play/next + volume slider
.sidebar 마지막 자식으로 append (flex column → 자동 하단 배치)
css/sidebar/tabs.css:65에 이미 84px padding 예약됨
에러 시 자동 다음 트랙, 사이드바 접어도 오디오 유지


Part 3: 커뮤니티 마커 추가 모드 버그 수정
문제 A: 마커 추가 후 패널이 바로 안 나옴

js/dev-tools.js의 createAddMarkerModal(): Leaflet popup을 .bindPopup()만 하고 .openPopup() 호출 안 함
수정: 마커 생성 후 setTimeout(() => marker.openPopup(), 100) 추가 (navigation.js 패턴 참고)

문제 B: 닫으면 SVG 마커 사라짐

closeAddMarkerModal()에서 devState.tempMarker 제거 로직 확인 → 의도된 동작이면 유지, 아니면 저장 전까지 유지하도록 수정

문제 C: 커뮤니티 모드 전환 지연

js/map/community.js의 toggleCommunityMode(): updateSettingWithTimestamp()이 .then()만 사용, await 없음
fetchCommunityMarkers()와 renderMapDataAndMarkers() 간 race condition
수정: async/await 통일, 버튼 상태 업데이트를 렌더 완료 후로 이동


Part 4: 스크린샷 다중 이미지 (DB 필드 확장)
백엔드

backend/db/index.js: custom_markers에 screenshots_json TEXT 필드 추가 (마이그레이션)
backend/routes/revisions.js: revision 승인 시 기존 screenshots에 append (replace 아님)
backend/routes/markers.js: PATCH 엔드포인트에서 screenshots_json 지원
기존 screenshot 필드와 하위호환: screenshots_json || screenshot fallback

프론트엔드

js/data/loader.js (line 117): item.images = [revOverride.screenshot] → 기존 이미지 + 신규 이미지 병합
js/map/community.js (line 37): screenshots_json 파싱하여 images 배열 구성
라이트박스/슬라이드쇼: 이미 다중 이미지 지원됨 (js/ui/lightbox.js)


Part 5: 커뮤니티 마커 표시 설정 (환경설정에 추가)
커뮤니티 모드 토글을 사이드바 툴바에서 제거하고, **환경설정(Settings Modal)**에 토글 추가.

기본값: ON (커뮤니티 마커 항상 표시)
사용자가 끄면 커뮤니티 마커 숨김
기존 state.showCommunityMarkers + updateSettingWithTimestamp 재사용
사이드바 카운트: 설정 ON일 때만 합산

수정 파일

components/settings-modal.html: 커뮤니티 마커 표시 토글 추가
js/settings/toggles.js: 토글 초기화 + 이벤트 바인딩
js/map/community.js: 사이드바 툴바 토글 버튼 제거 (환경설정으로 이동)
js/ui/sidebar/categories.js: 커뮤니티 마커 합산 로직
js/ui/sidebar/regions.js: 커뮤니티 마커 합산 로직

Part 6: 다음 세션으로 보류

사이드바 UI/UX 대폭 개선
커뮤니티 툴바(마커 추가/수정/이동) 사이드바 통합


검증

설정 모달 → 클라우드 백업 깜빡임 없이 로드
BGM 플레이어: 재생/정지/이전/다음/볼륨/progress bar
커뮤니티 모드: 마커 추가 클릭 → 패널 즉시 표시, 토글 즉시 전환
마커에 사진 추가 → 기존 스크린샷 유지 + 새 사진 추가 (슬라이드)