import { memoryManager } from '../memory.js';

export class MarkerPool {
    constructor() {
        this.pool = [];
        this.activeMarkers = new Map();
        this.MAX_POOL_SIZE = 200; 

        
        
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
            
            memoryManager.track(marker, `Marker-${options.itemId || 'unknown'}`);
        }

        
        memoryManager.setMeta(marker, {
            created: Date.now(),
            itemId: options.itemId,
            originalOptions: { ...options }
        });

        this.activeMarkers.set(options.itemId, marker);
        return marker;
    }

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

    clearAll() {
        this.activeMarkers.forEach(marker => {
            if (this.pool.length < this.MAX_POOL_SIZE) {
                this.pool.push(marker);
            }
        });
        this.activeMarkers.clear();
    }

    
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
