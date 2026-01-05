export function initAds() {
    const adContainer = document.querySelector('.ad-container');
    if (!adContainer) return;
    const ads = [
        {
            type: 'google',
            weight: 0,
            render: (container) => {
                const script = document.createElement('script');
                script.async = true;
                script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6903444943515445";
                script.crossOrigin = "anonymous";
                document.head.appendChild(script);
            }
        },
        {
            type: 'coffee',
            weight: 100,
            render: (container) => {
                const el = createAdElement('☕ 커피 한잔 정도는?', '커피 비용 후원', 'linear-gradient(135deg, #FFDD00 0%, #FBB03B 100%)', '#000000');

                const title = el.querySelector('.ad-title');
                const badge = el.querySelector('.ad-badge');
                const shadow = '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff';
                if (title) title.style.textShadow = shadow;
                if (badge) badge.style.textShadow = shadow;

                const imgLayer = document.createElement('div');
                imgLayer.style.position = 'absolute';
                imgLayer.style.right = '0';
                imgLayer.style.bottom = '0';
                imgLayer.style.height = '100%';
                imgLayer.style.width = '50%';
                imgLayer.style.pointerEvents = 'none';
                imgLayer.style.display = 'flex';
                imgLayer.style.alignItems = 'flex-end';
                imgLayer.style.justifyContent = 'flex-end';
                imgLayer.style.overflow = 'hidden';
                imgLayer.style.borderRadius = '16px';

                const img = document.createElement('img');
                img.src = 'image/coffee.png';
                img.style.height = '110%';
                img.style.objectFit = 'contain';
                img.style.transform = 'translateY(10%) translateX(10%)';

                imgLayer.appendChild(img);
                el.style.position = 'relative';
                el.insertBefore(imgLayer, el.firstChild);
                el.onclick = () => window.open('https://buymeacoffee.com/wwmmap', '_blank');
                container.innerHTML = '';
                container.appendChild(el);
            }
        },
        {
            type: 'public',
            weight: 0,
            render: (container) => {
                const el = createAdElement('공익 광고 캠페인', '수익 미발생', '#2ecc71', '#ffffff');
                container.innerHTML = '';
                container.appendChild(el);
            }
        },
        {
            type: 'alliance',
            weight: 0,
            render: (container) => {
                const el = createAdElement('자체 광고', '수익 미발생', '#3498db', '#ffffff');
                container.innerHTML = '';
                container.appendChild(el);
            }
        }
    ];

    function showRandomAd() {
        const totalWeight = ads.reduce((sum, ad) => sum + ad.weight, 0);
        if (totalWeight === 0) return;

        let random = Math.random() * totalWeight;
        let selectedAd = ads[0];

        for (const ad of ads) {
            if (random < ad.weight) {
                selectedAd = ad;
                break;
            }
            random -= ad.weight;
        }

        selectedAd.render(adContainer);
    }

    showRandomAd();
    setInterval(showRandomAd, 30000);
}

function createAdElement(title, badgeText, bgStyle, textColor) {
    const div = document.createElement('div');
    div.className = 'ad-placeholder';

    if (bgStyle.includes('gradient')) {
        div.style.background = bgStyle;
    } else {
        div.style.backgroundColor = bgStyle;
    }

    div.style.color = textColor;
    div.style.border = 'none';
    div.style.cursor = 'pointer';

    div.innerHTML = `
        <span class="ad-title" style="z-index: 1;">${title}</span>
        <span class="ad-badge" style="z-index: 1;">${badgeText}</span>
    `;

    return div;
}
