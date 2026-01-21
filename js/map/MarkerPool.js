// @ts-check
const L = /** @type {any} */ (window).L;
import { memoryManager } from "../memory.js";

/**
 * Manages a pool of Leaflet markers to reduce garbage collection overhead.
 */
export class MarkerPool {
  constructor() {
    /** @type {any[]} */
    this.pool = [];
    /** @type {Map<string|number, any>} */
    this.activeMarkers = new Map();
    /** @type {number} */
    this.MAX_POOL_SIZE = 200;
  }

  /**
   * Gets a marker from the pool or creates a new one.
   * @param {number} lat - Latitude.
   * @param {number} lng - Longitude.
   * @param {Object} options - Marker options.
   * @param {any} options.icon - Marker icon.
   * @param {string} [options.title] - Marker title.
   * @param {string} [options.alt] - Marker alt text.
   * @param {string|number} [options.itemId] - Item ID.
   * @returns {any} The marker instance.
   */
  getMarker(lat, lng, options) {
    let marker;
    if (this.pool.length > 0) {
      marker = this.pool.pop();
      marker.setLatLng([lat, lng]);
      marker.setIcon(options.icon);
      marker.options.title = options.title;
      marker.options.alt = options.alt;
      marker.options.itemId = options.itemId;
    } else {
      marker = L.marker([lat, lng], options);

      memoryManager.track(marker, `Marker-${options.itemId || "unknown"}`);
    }

    memoryManager.setMeta(marker, {
      created: Date.now(),
      itemId: options.itemId,
      originalOptions: { ...options },
    });

    this.activeMarkers.set(options.itemId, marker);
    return marker;
  }

  /**
   * Releases a marker back to the pool.
   * @param {string|number} itemId - The item ID of the marker to release.
   * @returns {any|null} The released marker, or null if not found.
   */
  releaseMarker(itemId) {
    const marker = this.activeMarkers.get(itemId);
    if (marker) {
      this.activeMarkers.delete(itemId);

      if (this.pool.length < this.MAX_POOL_SIZE) {
        this.pool.push(marker);
      } else {
      }
      return marker;
    }
    return null;
  }

  /**
   * Clears all active markers and moves them to the pool.
   */
  clearAll() {
    this.activeMarkers.forEach((marker) => {
      if (this.pool.length < this.MAX_POOL_SIZE) {
        this.pool.push(marker);
      }
    });
    this.activeMarkers.clear();
  }

  /**
   * Destroys the pool and all markers.
   */
  destroy() {
    this.activeMarkers.clear();
    this.pool = [];
  }

  /**
   * Gets pool statistics.
   * @returns {{poolSize: number, activeCount: number}}
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.activeMarkers.size,
    };
  }
}

export const markerPool = new MarkerPool();
