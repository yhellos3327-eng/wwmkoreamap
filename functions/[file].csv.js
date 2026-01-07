/**
 * Cloudflare Pages Function - CSV 뷰어 리다이렉트
 * 
 * *.csv 파일에 접근할 때:
 * - ?raw=1 파라미터가 있으면: 원본 CSV 파일 반환
 * - 브라우저에서 직접 접근하면: CSV 뷰어로 리다이렉트
 */

export async function onRequest(context) {
    const { request, params, env } = context;
    const url = new URL(request.url);
    const fileName = params.file + '.csv';

    // ?raw=1 파라미터가 있으면 원본 파일 반환 (다운로드용)
    if (url.searchParams.get('raw') === '1') {
        // ASSETS에서 원본 파일 가져오기
        const assetUrl = new URL(`/${fileName}`, url.origin);
        assetUrl.searchParams.delete('raw'); // raw 파라미터 제거

        try {
            // 정적 에셋 직접 가져오기
            const response = await env.ASSETS.fetch(assetUrl.toString());
            if (response.ok) {
                return new Response(response.body, {
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${fileName}"`,
                    },
                });
            }
        } catch (e) {
            // fallback: 직접 fetch 시도
        }

        // Fallback: 원본 요청 통과
        return context.next();
    }

    // Accept 헤더 확인 - 브라우저 요청인지 API/fetch 요청인지 구분
    const acceptHeader = request.headers.get('Accept') || '';
    const isBrowserRequest = acceptHeader.includes('text/html');

    // 브라우저에서 직접 접근한 경우 뷰어로 리다이렉트
    if (isBrowserRequest) {
        const viewerUrl = new URL('/csv-viewer.html', url.origin);
        viewerUrl.searchParams.set('file', fileName);

        return Response.redirect(viewerUrl.toString(), 302);
    }

    // API/fetch 요청의 경우 원본 파일 반환
    return context.next();
}
