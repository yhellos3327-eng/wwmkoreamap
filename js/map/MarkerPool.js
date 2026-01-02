export class MarkerPool {
    constructor() {
        this.pool = [];
        this.activeMarkers = new Map();
        this.MAX_POOL_SIZE = 200; // Limit pool size to prevent memory leak
    }

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
        }
        this.activeMarkers.set(options.itemId, marker);
        return marker;
    }

    releaseMarker(itemId) {
        const marker = this.activeMarkers.get(itemId);
        if (marker) {
            this.activeMarkers.delete(itemId);
            // Only add to pool if under limit
            if (this.pool.length < this.MAX_POOL_SIZE) {
                this.pool.push(marker);
            }
            return marker;
        }
        return null;
    }

    clearAll() {
        this.activeMarkers.forEach(marker => {
            if (this.pool.length < this.MAX_POOL_SIZE) {
                this.pool.push(marker);
            }
        });
        this.activeMarkers.clear();
    }

    // Full cleanup - use when switching render modes
    destroy() {
        this.activeMarkers.clear();
        this.pool = [];
    }

    getStats() {
        return {
            poolSize: this.pool.length,
            activeCount: this.activeMarkers.size
        };
    }
}

export const markerPool = new MarkerPool();
