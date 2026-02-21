// @ts-check
/**
 * 메모리 관리 유틸리티
 * 효율적인 메모리 관리 및 누수 탐지를 위한 도구를 제공합니다.
 */

export class MemoryManager {
  constructor() {
    this.registry = null;
    this.weakMap = new WeakMap();
    this.debugMode = false;
    this.activeCount = 0;
    this.stats = {
      markers: 0,
      sprites: 0,
      textures: 0,
      others: 0,
    };

    if (window.FinalizationRegistry) {
      this.registry = new FinalizationRegistry(this._cleanup.bind(this));
    }
  }

  /**
   * 메모리 이벤트에 대한 디버그 로깅 활성화 또는 비활성화
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugMode = enabled;
    console.log(
      `%c[MemoryManager] Debug Mode: ${enabled ? "ON" : "OFF"}`,
      "color: #ff00ff; font-weight: bold;",
    );
    if (enabled) {
      this.logStats();
    }
  }

  /**
   * 가비지 컬렉션 모니터링을 위해 객체를 추적합니다.
   * @param {Object} target - 추적할 객체.
   * @param {string} label - 객체를 식별하기 위한 라벨.
   * @param {Function} [cleanupCallback] - 수거될 때 실행할 선택적 콜백 (참고: target은 이미 사라진 상태임).
   */
  track(target, label, cleanupCallback = null) {
    if (!this.registry) return;

    this.activeCount++;
    if (label.includes("Marker")) this.stats.markers++;
    else if (label.includes("Sprite")) this.stats.sprites++;
    else if (label.includes("Texture")) this.stats.textures++;
    else this.stats.others++;

    const heldValue = {
      label,
      cleanupCallback,
      timestamp: Date.now(),
      type: this._getTypeFromLabel(label),
    };
    this.registry.register(target, heldValue);

    if (this.debugMode) {
      console.log(
        `[MemoryManager] 🟢 Tracking: ${label} (Total Active: ${this.activeCount})`,
      );
    }
  }

  _getTypeFromLabel(label) {
    if (label.includes("Marker")) return "markers";
    if (label.includes("Sprite")) return "sprites";
    if (label.includes("Texture")) return "textures";
    return "others";
  }

  /**
   * WeakMap을 사용하여 객체와 메타데이터를 연결합니다.
   * @param {Object} target
   * @param {any} data
   */
  setMeta(target, data) {
    this.weakMap.set(target, data);
  }

  /**
   * 객체와 연결된 메타데이터를 가져옵니다.
   * @param {Object} target
   * @returns {any}
   */
  getMeta(target) {
    return this.weakMap.get(target);
  }

  /**
   * 내부 클린업 핸들러
   * @param {Object} heldValue
   */
  _cleanup(heldValue) {
    this.activeCount--;
    if (this.stats[heldValue.type] > 0) this.stats[heldValue.type]--;

    if (this.debugMode) {
      const duration = Date.now() - heldValue.timestamp;
      console.log(
        `[MemoryManager] 🗑️ Garbage Collected: ${heldValue.label} (lived for ${duration}ms) | Remaining: ${this.activeCount}`,
      );
    }

    if (
      heldValue.cleanupCallback &&
      typeof heldValue.cleanupCallback === "function"
    ) {
      try {
        heldValue.cleanupCallback();
      } catch (e) {
        console.error(
          `[MemoryManager] Error in cleanup callback for ${heldValue.label}:`,
          e,
        );
      }
    }
  }

  logStats() {
    console.table({
      "Total Active Objects": this.activeCount,
      "Markers (Leaflet)": this.stats.markers,
      "Sprites (Pixi)": this.stats.sprites,
      Textures: this.stats.textures,
      Others: this.stats.others,
    });
  }
}

export const memoryManager = new MemoryManager();
