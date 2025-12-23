document.addEventListener('DOMContentLoaded', () => {
    const adContainer = document.querySelector('.ad-container');
    if (!adContainer) return;
    const ads = [
        {
            type: 'google',
            weight: 100,
            render: (container) => {
                container.innerHTML = '';
                if (!document.getElementById('google-adsense-script')) {
                    const script = document.createElement('script');
                    script.id = 'google-adsense-script';
                    script.async = true;
                    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6903444943515445';
                    script.crossOrigin = 'anonymous';
                    document.head.appendChild(script);
                }

                const ins = document.createElement('ins');
                ins.className = 'adsbygoogle';
                ins.style.display = 'block';
                ins.setAttribute('data-ad-client', 'ca-pub-6903444943515445');
                ins.setAttribute('data-ad-slot', 'REPLACE_WITH_YOUR_AD_SLOT_ID');
                ins.setAttribute('data-ad-format', 'auto');
                ins.setAttribute('data-full-width-responsive', 'true');
                container.appendChild(ins);

                const pushScript = document.createElement('script');
                pushScript.textContent = '(adsbygoogle = window.adsbygoogle || []).push({});';
                container.appendChild(pushScript);
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

        // 심사 기간 안내 메시지 추가
        const notice = document.createElement('h3');
        notice.style.textAlign = 'center';
        notice.style.fontSize = '0.8rem';
        notice.style.color = '#888';
        notice.style.marginTop = '8px';
        notice.style.fontWeight = 'normal';
        notice.innerHTML = '설정에서 끄실 수 있습니다.<br>심사 설정 때문에 임시로 광고 설정을 ON으로 조정하였습니다. 🙇‍♂️<br>이후 공익 광고등 랜덤으로 표시될 예정입니다. (수익 X)';
        adContainer.appendChild(notice);
    }

    showRandomAd();
    //setInterval(showRandomAd, 30000);
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