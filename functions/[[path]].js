export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname.endsWith('.csv')) {
        const fileName = pathname.split('/').pop();
        const referer = request.headers.get('Referer') || '';
        const accept = request.headers.get('Accept') || '';
        if (referer.includes('csv-viewer.html') ||
            accept.includes('application/json') ||
            url.searchParams.has('raw') ||
            url.searchParams.has('download')) {
            return next();
        }
        if (accept.includes('text/html')) {
            const viewerUrl = new URL('/csv-viewer.html', url.origin);
            viewerUrl.searchParams.set('file', pathname);

            return Response.redirect(viewerUrl.toString(), 302);
        }
        return next();
    }

    return next();
}
