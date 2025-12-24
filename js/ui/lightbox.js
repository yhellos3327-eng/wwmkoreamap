import { state, setState } from '../state.js';

function updateLightboxImage() {
    const container = document.getElementById('lightbox-media-container');
    if (!container) return;

    const mediaList = state.currentLightboxMedia;
    const index = state.currentLightboxIndex;

    if (mediaList && mediaList[index]) {
        const media = mediaList[index];
        container.innerHTML = '';

        if (media.type === 'image') {
            const img = document.createElement('img');
            img.src = media.src;
            img.className = 'lightbox-content';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            container.appendChild(img);
        } else if (media.type === 'video') {
            let videoSrc = media.src.replace(/^http:/, 'https:');
            if (videoSrc.startsWith('//')) videoSrc = 'https:' + videoSrc;

            let embedSrc = videoSrc;

            const ytMatch = videoSrc.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (ytMatch && ytMatch[1]) {
                embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
            }

            if (videoSrc.includes('bilibili.com')) {
                const separator = videoSrc.includes('?') ? '&' : '?';
                embedSrc = videoSrc.replace(/&?autoplay=\d/, '');
                embedSrc += `${separator}autoplay=1&high_quality=1`;
            }

            const iframe = document.createElement('iframe');
            iframe.src = embedSrc;
            iframe.style.width = '80vw';
            iframe.style.height = '80vh';
            iframe.style.maxWidth = '1200px';
            iframe.style.maxHeight = '675px';
            iframe.frameBorder = '0';
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
            iframe.allowFullscreen = true;
            container.appendChild(iframe);
        }
    }
}

export const openLightbox = (itemId, index) => {
    if (typeof itemId === 'string' && (itemId.startsWith('http') || itemId.startsWith('//') || itemId.startsWith('./'))) {
        setState('currentLightboxMedia', [{ type: 'image', src: itemId }]);
        setState('currentLightboxIndex', 0);
        updateLightboxImage();
        const modal = document.getElementById('lightbox-modal');
        modal.classList.remove('hidden');
        const navBtns = modal.querySelectorAll('.lightbox-nav');
        navBtns.forEach(btn => btn.style.display = 'none');
        return;
    }

    const item = state.mapData.items.find(i => i.id == itemId);
    if (!item) {
        console.warn('Lightbox: Item not found', itemId);
        return;
    }

    const mediaList = [];
    if (item.images && item.images.length > 0) {
        item.images.forEach(img => mediaList.push({ type: 'image', src: img }));
    }

    if (item.video_url) {
        if (Array.isArray(item.video_url)) {
            item.video_url.forEach(url => {
                if (url && typeof url === 'string' && url.trim() !== "") {
                    mediaList.push({ type: 'video', src: url.trim() });
                }
            });
        } else if (typeof item.video_url === 'string' && item.video_url.trim() !== "") {
            mediaList.push({ type: 'video', src: item.video_url.trim() });
        }
    }

    if (mediaList.length === 0) {
        console.warn('Lightbox: No media found for item', itemId);
        return;
    }

    setState('currentLightboxMedia', mediaList);
    setState('currentLightboxIndex', index || 0);

    updateLightboxImage();

    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('hidden');

    const navBtns = modal.querySelectorAll('.lightbox-nav');
    navBtns.forEach(btn => {
        btn.style.display = state.currentLightboxMedia.length > 1 ? 'block' : 'none';
    });
};

export const switchLightbox = (direction) => {
    const total = state.currentLightboxMedia.length;
    if (total <= 1) return;

    let idx = state.currentLightboxIndex + direction;

    if (idx >= total) idx = 0;
    if (idx < 0) idx = total - 1;

    setState('currentLightboxIndex', idx);
    updateLightboxImage();
};

export const closeLightbox = () => {
    document.getElementById('lightbox-modal').classList.add('hidden');
    const container = document.getElementById('lightbox-media-container');
    if (container) container.innerHTML = '';
};

export const openVideoLightbox = (src) => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        iframe.src = src;
        modal.classList.remove('hidden');
    }
};

export const closeVideoLightbox = () => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        modal.classList.add('hidden');
        iframe.src = "";
    }
};

export const viewFullImage = (src) => {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    modal.classList.remove('hidden');
};

export const switchImage = (btn, direction) => {
    const container = btn.parentElement;
    const images = container.querySelectorAll('.popup-media');
    const counter = container.querySelector('.img-counter');

    let currentIdx = parseInt(container.dataset.idx);
    const total = parseInt(container.dataset.total);

    images[currentIdx].classList.remove('active');
    currentIdx += direction;
    if (currentIdx >= total) currentIdx = 0;
    if (currentIdx < 0) currentIdx = total - 1;

    images[currentIdx].classList.add('active');
    container.dataset.idx = currentIdx;
    if (counter) counter.innerText = `${currentIdx + 1} / ${total}`;
};
