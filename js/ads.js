document.addEventListener('DOMContentLoaded', () => {
    const adContainer = document.querySelector('.ad-container');
    if (!adContainer) return;

    // 로컬 환경인지 확인 (localhost, 127.0.0.1, file://)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';

    const ads = [
        {
            type: 'kakao',
            weight: isLocal ? 0 : 100, // [심사 기간 임시 설정] 배포 환경에서는 카카오 광고만 100% 노출
            render: (container) => {
                container.innerHTML = '';

                const ins = document.createElement('ins');
                ins.className = 'kakao_ad_area';
                ins.style.display = 'none';
                ins.setAttribute('data-ad-unit', 'DAN-sL10OTBFL3WHRTPY');
                ins.setAttribute('data-ad-width', '320');
                ins.setAttribute('data-ad-height', '100');
                container.appendChild(ins);

                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
                script.async = true;
                container.appendChild(script);
            }
        },
        {
            type: 'public',
            weight: 0, // 심사 기간 동안 0으로 설정
            render: (container) => {
                const el = createAdElement('공익 광고 캠페인', '수익 미발생', '#2ecc71', '#ffffff');
                container.innerHTML = '';
                container.appendChild(el);
            }
        },
        {
            type: 'alliance',
            weight: 0, // 심사 기간 동안 0으로 설정
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
});

function createAdElement(title, badgeText, bgColor, textColor) {
    const div = document.createElement('div');
    div.className = 'ad-placeholder';
    div.style.backgroundColor = bgColor;
    div.style.color = textColor;
    div.style.border = 'none';
    div.style.cursor = 'pointer';

    div.innerHTML = `
        <span class="ad-title">${title}</span>
        <span class="ad-badge">${badgeText}</span>
    `;

    return div;
}