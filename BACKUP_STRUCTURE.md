# 💾 데이터 저장 및 백업 구조 (Data Persistence & Backup Architecture)

이 문서는 프로젝트의 데이터 저장, 동기화, 그리고 백업 프로세스의 구조와 흐름을 설명합니다.
시스템은 **3중 보호 계층(Local - Vault - Cloud)**으로 구성되어 데이터 유실을 원천 차단합니다.

---

## 1. 전체 데이터 흐름도 (Data Flow)

```mermaid
graph TD
    User[사용자 액션] -->|1. 상태 변경| State[Global State (Zustand)]
    State -->|2. 즉시 저장| LS[LocalStorage (브라우저)]
    
    LS -->|3. 변경 감지 (Debounce)| SyncTrigger[동기화 트리거]
    
    subgraph "🛡️ Safety Zone (Local Vault)"
        SyncTrigger -->|4. 전송 전 백업| VaultPre[Vault: pre_cloud_save]
        VaultPre -->|IndexedDB| DexieDB[(Dexie.js DB)]
    end
    
    subgraph "☁️ Cloud Sync"
        VaultPre -->|5. 데이터 무결성 검사| IntegrityCheck{데이터 안전?}
        IntegrityCheck -->|Pass| CloudPush[클라우드 전송]
        IntegrityCheck -->|Fail| Block[차단 & 경고]
        
        CloudPush -->|6. 저장 완료| CloudDB[(Firebase/Backend)]
    end
    
    CloudPush -->|7. 성공 시 백업| VaultPost[Vault: sync_success]
    VaultPost -->|IndexedDB| DexieDB
```

---

## 2. 저장소 계층 구조 (Storage Layers)

### 1계층: LocalStorage (즉시 반영)
*   **역할**: UI와 가장 가까운 저장소, 새로고침 시 상태 유지.
*   **특징**: 가장 빠르지만, 브라우저 청소 시 날아갈 수 있음.
*   **보호 장치**: `js/sync/storage.js`의 `setLocalData`에서 기존 데이터가 있는데 빈 값(`[]`)으로 덮어쓰려는 시도를 차단.

### 2계층: Vault (Local Backup - Dexie.js)
*   **역할**: 로컬 기기 내의 안전 금고. 클라우드 전송 전/후, 초기화 시점 등 중요 순간마다 스냅샷 저장.
*   **기술**: IndexedDB (via Dexie.js)
*   **저장 시점**:
    *   `auto`: 주기적 자동 저장
    *   `pre_cloud_save`: 클라우드 동기화 직전 (가장 중요)
    *   `sync_success`: 클라우드 동기화 성공 후
    *   `manual`: 사용자가 수동으로 저장
*   **관리**: 최대 50개의 최근 스냅샷 유지 (자동 정리).

### 3계층: Cloud Storage (원격 동기화)
*   **역할**: 기기 간 데이터 연동 및 영구 보관.
*   **보호 장치**:
    *   **Merge Guard**: 서버 데이터와 로컬 데이터를 합칠 때, 빈 데이터가 되면 로컬 데이터를 우선시함.
    *   **Sync Guard**: 로컬 데이터가 0개인 상태로 업로드를 시도하면 차단.

---

## 3. 상세 프로세스 (Detailed Process)

### A. 데이터 저장 프로세스
1.  사용자가 마커를 완료하거나 설정을 변경합니다.
2.  `localStorage`에 즉시 반영됩니다.
3.  `triggerSync()`가 호출되어 2초간 대기(Debounce)합니다.
4.  **[Vault]** `pre_cloud_save` 스냅샷을 생성합니다. (혹시 모를 전송 오류 대비)
5.  데이터 무결성을 검사합니다. (기존 데이터 대비 급격한 삭제 여부 등)
6.  클라우드 API로 데이터를 전송합니다.
7.  전송 성공 시, **[Vault]** `sync_success` 스냅샷을 생성합니다.

### B. 초기화 및 복구 프로세스 (`js/main.js`)
1.  앱이 실행되면 `localStorage`를 확인합니다.
2.  데이터가 비어있거나 손상된 경우, **Vault**에서 가장 최신의 백업을 조회합니다.
3.  백업이 있다면 자동으로 복구(`restoreFromVault`)하고, UI 상태를 갱신합니다.
4.  이후 클라우드 동기화를 시작하여 최신 데이터를 가져옵니다.

---

## 4. 주요 파일 및 역할

| 파일 경로 | 역할 | 핵심 함수 |
| :--- | :--- | :--- |
| `js/sync/core.js` | 동기화 총괄 컨트롤러 | `saveToCloud`, `triggerSync` |
| `js/sync/storage.js` | 로컬 스토리지 입출력 및 방어 | `setLocalData` (빈 데이터 차단) |
| `js/storage/vault.js` | 로컬 백업 관리자 | `saveToVault`, `autoRestoreIfEmpty` |
| `js/storage/db.js` | IndexedDB 래퍼 (Dexie) | `db.add`, `db.prune` |
| `js/settings/backup.js` | 백업 UI 및 검사 도구 | `handleVaultInspect` (DB 구조 보기) |

---

## 5. 데이터 무결성 검사 (Integrity Guards)

시스템은 다음 상황을 "비정상"으로 간주하고 차단합니다:

1.  **Storage Guard**: 마커가 5개 이상 있었는데, 갑자기 0개인 배열로 `localStorage`를 덮어쓰려 할 때.
2.  **Merge Guard**: 클라우드와 병합했는데 결과가 비어있고, 로컬에는 데이터가 있었을 때 -> 로컬 데이터 유지.
3.  **Sync Guard**: 이전에 동기화한 기록이 있는데, 이번에 보낼 데이터가 0개일 때.
