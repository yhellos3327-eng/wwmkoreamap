// @ts-check
/**
 * Memory Management Utility
 * Provides tools for efficient memory management and leak detection.
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
   * Enable or disable debug logging for memory events
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
   * Track an object for garbage collection monitoring
   * @param {Object} target - The object to track
   * @param {string} label - A label to identify the object
   * @param {Function} [cleanupCallback] - Optional callback to run when collected (Note: target is already gone)
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
   * Associate metadata with an object using WeakMap
   * @param {Object} target
   * @param {any} data
   */
  setMeta(target, data) {
    this.weakMap.set(target, data);
  }

  /**
   * Retrieve metadata associated with an object
   * @param {Object} target
   * @returns {any}
   */
  getMeta(target) {
    return this.weakMap.get(target);
  }

  /**
   * Internal cleanup handler
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
