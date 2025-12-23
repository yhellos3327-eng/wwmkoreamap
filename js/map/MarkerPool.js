export class MarkerPool {
    constructor() {
        this.pool = [];
        this.activeMarkers = new Map();
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
            this.pool.push(marker);
            return marker;
        }
        return null;
    }

    clearAll() {
        this.activeMarkers.forEach(marker => {
            this.pool.push(marker);
        });
        this.activeMarkers.clear();
    }
}

export const markerPool = new MarkerPool();
