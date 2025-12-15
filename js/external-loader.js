export const loadExternalContent = async (url, container) => {
    if (!url || !container) return;
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:150px; flex-direction:column; gap:10px;">
            <div class="loading-spinner" style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite;"></div>
            <span style="color:var(--text-muted); font-size:0.9em;">외부 콘텐츠를 불러오는 중...</span>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    if (url.startsWith('json:')) {
        await loadJsonContent(url, container);
        return;
    }

    try {
        let response;
        try {
            response = await fetch(url);
        } catch (e) {
            console.warn("Direct fetch failed, trying proxy...", e);
            try {
                response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                if (!response.ok) throw new Error('Proxy fetch failed');
                const data = await response.json();
                if (!data.contents) throw new Error('Proxy returned no content');
                parseAndInject(data.contents, container, url);
                return;
            } catch (proxyError) {
                throw new Error('Both direct and proxy fetch failed: ' + proxyError.message);
            }
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        parseAndInject(text, container, url);

    } catch (error) {
        console.error("External content load failed:", error);
        container.innerHTML = `
            <div style="padding:20px; text-align:center; color:var(--text-muted);">
                <p>콘텐츠를 불러올 수 없습니다.</p>
                <p style="font-size:0.8em; color:#666;">${error.message}</p>
                <a href="${url}" target="_blank" style="color:var(--accent); text-decoration:underline;">원본 페이지 방문하기</a>
            </div>
        `;
    }
};

const loadJsonContent = async (urlString, container) => {
    try {
        const actualUrl = urlString.substring(5);
        const urlObj = new URL(actualUrl);
        const id = urlObj.searchParams.get('id');
        const jsonUrl = actualUrl.split('?')[0];
        const origin = urlObj.origin;

        let response;
        try {
            response = await fetch(jsonUrl);
        } catch (e) {
            console.warn("Direct JSON fetch failed, trying proxy...", e);
            response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(jsonUrl)}`);
            if (!response.ok) throw new Error('Proxy fetch failed');
            const proxyData = await response.json();
            const data = JSON.parse(proxyData.contents);
            processJsonData(data, id, container, origin);
            return;
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        processJsonData(data, id, container, origin);

    } catch (error) {
        console.error("JSON content load failed:", error);
        container.innerHTML = `
            <div style="padding:20px; text-align:center; color:var(--text-muted);">
                <p>데이터를 불러올 수 없습니다.</p>
                <p>${error.message}</p>
            </div>
        `;
    }
};

const processJsonData = (data, id, container, origin) => {
    let item = null;
    if (data.chunji && Array.isArray(data.chunji)) {
        item = data.chunji.find(i => i.id === id);
    }

    if (!item) throw new Error('Item not found in JSON');

    const html = formatChunjiItem(item, origin);

    const styleBlock = document.createElement('style');
    styleBlock.textContent = `
        .quest-detail-container {
            --wuxia-accent-red: #b71c1c;
            --wuxia-accent-gold: #b08d55;
            --wuxia-text-main: #e0e0e0;
            --wuxia-text-sub: #aaaaaa;
            padding: 10px;
        }
        .quest-detail-container h2 { 
            color: var(--wuxia-accent-gold); 
            border-bottom: 1px solid #444; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
            font-size: 1.5em;
        }
        .quest-detail-container h3 { 
            color: var(--wuxia-accent-gold); 
            margin-top: 25px; 
            margin-bottom: 10px; 
            font-size: 1.2em;
            border-left: 3px solid var(--wuxia-accent-red);
            padding-left: 10px;
        }
        .quest-detail-container p { 
            color: var(--wuxia-text-main); 
            line-height: 1.6; 
            margin-bottom: 15px;
        }
        .wuxia-image-container { 
            margin: 15px 0; 
            border-radius: 4px; 
            overflow: hidden; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background-color: #2a2a2a;
        }
        .wuxia-image-container img { 
            width: 100%; 
            display: block; 
            cursor: pointer; 
            transition: transform 0.3s ease;
        }
        .wuxia-image-container:hover img {
            transform: scale(1.02);
        }
    `;

    container.innerHTML = '';
    container.appendChild(styleBlock);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'quest-detail-container';
    contentDiv.innerHTML = html;

    const sourceDiv = document.createElement('div');
    sourceDiv.style.cssText = "margin-top:40px;padding-top:20px;border-top:1px dashed #444;display:flex;justify-content:space-between;align-items:center;color:var(--wuxia-text-sub);font-size:0.9em";

    const domain = new URL(origin).hostname;

    sourceDiv.innerHTML = `
        <span>데이터 출처</span>
        <a href="${origin}" target="_blank" style="color:var(--wuxia-accent-gold);text-decoration:none;display:flex;align-items:center;gap:5px">
            ${domain} <span style="font-size:1.2em">↗</span>
        </a>
    `;
    contentDiv.appendChild(sourceDiv);

    container.appendChild(contentDiv);
};

const resolveUrl = (path, origin) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('//')) return 'https:' + path;
    try {
        return new URL(path, origin).href;
    } catch (e) {
        return path;
    }
};

const formatChunjiItem = (item, origin) => {
    const getImg1 = resolveUrl(item.getimg1, origin);
    const getImg2 = resolveUrl(item.getimg2, origin);
    const dsecImg1 = resolveUrl(item.dsecimg1, origin);
    const dsecImg2 = resolveUrl(item.dsecimg2, origin);

    return `
        <h2>${item.title}</h2>
        
        <h3>획득 방법</h3>
        <p>${item.get || '정보 없음'}</p>
        ${getImg1 ? `<div class="wuxia-image-container"><img src="${getImg1}" onclick="window.openLightbox(this.src)"></div>` : ''}
        ${getImg2 ? `<div class="wuxia-image-container"><img src="${getImg2}" onclick="window.openLightbox(this.src)"></div>` : ''}

        <h3>해독 방법</h3>
        <p>${item.dsec || '정보 없음'}</p>
        ${dsecImg1 ? `<div class="wuxia-image-container"><img src="${dsecImg1}" onclick="window.openLightbox(this.src)"></div>` : ''}
        ${dsecImg2 ? `<div class="wuxia-image-container"><img src="${dsecImg2}" onclick="window.openLightbox(this.src)"></div>` : ''}
    `;
};

const parseAndInject = (htmlString, container, originalUrl) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const content = doc.querySelector('.quest-detail-container') || doc.body;

    const firstSpan = content.querySelector('span');
    if (firstSpan) firstSpan.remove();

    const title = content.querySelector('h2');
    if (title) title.remove();

    const styleBlock = document.createElement('style');
    styleBlock.textContent = `
        .quest-detail-container {
            --wuxia-accent-red: #b71c1c;
            --wuxia-accent-gold: #b08d55;
            --wuxia-text-main: #e0e0e0;
            --wuxia-text-sub: #aaaaaa;
        }
        .wuxia-image-container {
            border: none !important;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            background-color: #2a2a2a;
            margin: 20px 0;
            position: relative;
        }
        .wuxia-image-container img {
            width: 100%;
            height: auto;
            display: block;
            filter: sepia(0.05) contrast(1.02);
            transition: transform 0.5s ease, filter 0.5s ease;
            cursor: pointer;
        }
        .wuxia-image-container:hover img {
            transform: scale(1.03);
            filter: sepia(0) contrast(1.05);
        }
        .wuxia-image-container::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            pointer-events: none;
        }
        /* Overwrite inline styles for dark mode compatibility */
        .quest-detail-container h3 { color: var(--wuxia-accent-gold) !important; }
        .quest-detail-container p { color: var(--wuxia-text-main) !important; }
        .quest-detail-container div[style*="background-color: #fffcf5"] {
            background-color: rgba(255,255,255,0.05) !important;
            border-color: var(--wuxia-accent-gold) !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
        }
        .quest-detail-container div[style*="background-color: #fff5f5"] {
            background-color: rgba(183,28,28,0.1) !important;
            border-color: var(--wuxia-accent-red) !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2) !important;
        }
        .quest-detail-container hr {
            border-top: 1px solid var(--border) !important;
            border-bottom: none !important;
        }
    `;
    container.appendChild(styleBlock);

    const images = content.querySelectorAll('img');
    images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
            const urlObj = new URL(originalUrl);
            try {
                img.src = new URL(src, originalUrl).href;
            } catch (e) {
                console.warn("Failed to resolve image URL:", src);
            }
        }

        img.style.cursor = 'pointer';
        img.onclick = () => {
            if (window.openLightbox) {
                window.openLightbox(img.src);
            } else {
                window.open(img.src, '_blank');
            }
        };

        if (!img.parentElement.classList.contains('wuxia-image-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'wuxia-image-container';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
    });

    const returnBtn = content.querySelector('button[onclick="showQuestList()"]');
    if (returnBtn) {
        returnBtn.parentElement.remove();
    }

    const sourceDiv = document.createElement('div');
    sourceDiv.style.cssText = "margin-top:40px;padding-top:20px;border-top:1px dashed #444;display:flex;justify-content:space-between;align-items:center;color:var(--wuxia-text-sub);font-size:0.9em";

    const domain = new URL(originalUrl).hostname;
    const origin = new URL(originalUrl).origin;

    sourceDiv.innerHTML = `
        <span>데이터 출처</span>
        <a href="${origin}" target="_blank" style="color:var(--wuxia-accent-gold);text-decoration:none;display:flex;align-items:center;gap:5px">
            ${domain} <span style="font-size:1.2em">↗</span>
        </a>
    `;

    content.appendChild(sourceDiv);

    container.innerHTML = '';
    container.appendChild(styleBlock);
    container.appendChild(content);
};
