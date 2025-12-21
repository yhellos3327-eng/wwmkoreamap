// notice/links.js - 링크 관련 기능

import { usefulLinks } from '../config.js';

export const renderLinks = () => {
    const linkListEl = document.getElementById('link-list');
    if (!linkListEl) return;

    linkListEl.innerHTML = '';

    usefulLinks.forEach((link, index) => {
        const a = document.createElement('a');
        a.className = 'link-card';
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.animationDelay = `${index * 0.1}s`;

        let icon = '🔗';
        if (link.title.includes('디스코드')) icon = '💬';
        if (link.title.includes('위키')) icon = '📚';
        if (link.title.includes('갤러리') || link.title.includes('채널')) icon = '👥';

        a.innerHTML = `
            <span class="link-icon">${icon}</span>
            <span class="link-title">${link.title}</span>
        `;
        linkListEl.appendChild(a);
    });
};
