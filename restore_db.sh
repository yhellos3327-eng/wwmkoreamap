#!/bin/bash
# Database Restore Script for map-tiles NAS

echo "=== Map-Tiles Database Restore Script ==="

# NAS 호스트에서 실행되어야 함
BACKUP_PATH="/tmp/restore/database (1).sqlite"
TARGET_PATH="/volume1/docker/backend/database.sqlite"
CONTAINER_NAME="map-tiles-backend"

# 1. 백업 파일 확인
if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ 백업 파일을 찾을 수 없습니다: $BACKUP_PATH"
    exit 1
fi

echo "✓ 백업 파일 확인: $BACKUP_PATH"

# 2. 대상 디렉토리 생성
mkdir -p "$(dirname "$TARGET_PATH")"
echo "✓ 대상 디렉토리 준비: $(dirname "$TARGET_PATH")"

# 3. 현재 DB 백업
if [ -f "$TARGET_PATH" ]; then
    cp "$TARGET_PATH" "${TARGET_PATH}.bak.$(date +%Y%m%d_%H%M%S)"
    echo "✓ 기존 데이터베이스 백업 완료"
fi

# 4. 복구 파일 복사
cp "$BACKUP_PATH" "$TARGET_PATH"
if [ $? -eq 0 ]; then
    echo "✓ 데이터베이스 파일 복사 완료"
else
    echo "❌ 파일 복사 실패"
    exit 1
fi

# 5. Docker 컨테이너 확인 및 재시작
if command -v docker &> /dev/null; then
    echo "Docker를 찾았습니다. 컨테이너 재시작 중..."

    # 컨테이너 재시작
    docker restart "$CONTAINER_NAME" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✓ Docker 컨테이너 재시작 완료"
        sleep 3
        echo "✓ 복구 완료!"
    else
        echo "⚠ Docker 컨테이너 재시작 실패 (수동으로 재시작해주세요)"
    fi
else
    echo "⚠ Docker를 찾을 수 없습니다. 다음 명령을 수동으로 실행하세요:"
    echo "   sudo systemctl restart docker"
    echo "   또는 Synology DSM에서 Docker 재시작"
fi

echo ""
echo "=== 복구 상태 확인 ==="
echo "데이터베이스 경로: $TARGET_PATH"
echo "파일 크기: $(ls -lh "$TARGET_PATH" | awk '{print $5}')"

# 복구된 데이터 확인
if command -v sqlite3 &> /dev/null; then
    count=$(sqlite3 "$TARGET_PATH" "SELECT COUNT(*) FROM marker_revisions 2>/dev/null" 2>/dev/null)
    if [ ! -z "$count" ]; then
        echo "✓ marker_revisions: $count개 기록"
    fi
fi

echo ""
echo "완료! API를 통해 데이터 복구 확인: curl https://api.wwmmap.kr/api/revisions"
