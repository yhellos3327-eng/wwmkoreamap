import { state, setState } from './state.js';
import { loadMapData } from './data.js';
import { initMap } from './map/init.js';
import { renderMapDataAndMarkers } from './map/markers.js';


const logEl = document.getElementById('bench-log');
const fpsEl = document.getElementById('stat-fps');
const avgEl = document.getElementById('stat-avg');
const lowEl = document.getElementById('stat-low');
const timeEl = document.getElementById('stat-time');
const markerEl = document.getElementById('stat-markers');
const canvas = document.getElementById('fps-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-bench');
const cpuBtn = document.getElementById('mode-cpu');
const gpuBtn = document.getElementById('mode-gpu');
const statusRenderer = document.getElementById('status-renderer');
const loadingBar = document.getElementById('loading-bar');
const loadingScreen = document.getElementById('loading-screen');

let frames = 0;
let lastTime = performance.now();
let fpsHistory = [];
let isBenchmarking = false;

const resizeCanvas = () => {
    const container = canvas.parentElement;
    if (!container) return;
    canvas.width = container.clientWidth - 40;
    canvas.height = container.clientHeight - 60;
};
window.addEventListener('resize', resizeCanvas);

const log = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
    if (type === 'error') entry.style.color = '#ff4444';
    if (type === 'success') entry.style.color = '#ffbd53';
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
};

const updateFPS = () => {
    const now = performance.now();
    frames++;

    if (now >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        fpsEl.textContent = fps.toString().padStart(2, '0');

        fpsHistory.push(fps);
        if (fpsHistory.length > 200) fpsHistory.shift();

        updateStats();
        drawChart();

        frames = 0;
        lastTime = now;
    }

    const frameTime = now - lastTime;
    if (frames > 0) {
        timeEl.textContent = `${Math.round(frameTime / frames)}ms`;
    }

    requestAnimationFrame(updateFPS);
};

const updateStats = () => {
    if (fpsHistory.length === 0) return;

    const avg = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
    avgEl.textContent = avg;

    const sorted = [...fpsHistory].sort((a, b) => a - b);
    const lowIndex = Math.max(0, Math.floor(fpsHistory.length * 0.01));
    lowEl.textContent = sorted[lowIndex];

    if (state.mapData && state.mapData.items) {
        markerEl.textContent = state.mapData.items.length;
    }
};

const drawChart = () => {
    if (!canvas.width) resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (fpsHistory.length < 2) return;

    const maxFPS = 120;
    const step = canvas.width / (fpsHistory.length - 1);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        const y = canvas.height - (canvas.height * (i / 4));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = '#ffbd53';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    fpsHistory.forEach((fps, i) => {
        const x = i * step;
        const y = canvas.height - (Math.min(fps, maxFPS) / maxFPS) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255, 189, 83, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 189, 83, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
};

const runStressTest = async (autoCompare = false) => {
    if (isBenchmarking) return;

    isBenchmarking = true;
    fpsHistory = [];
    startBtn.classList.add('active');
    log("DYNAMIC STRESS TEST INITIATED", "success");

    const modes = autoCompare ? [false, true] : [state.gpuRenderMode];
    const results = [];

    const allItems = state.mapData.items.filter(item => item.x && item.y);
    if (allItems.length === 0) {
        log("Error: No marker data found for testing (Check x/y coordinates)", "error");
        isBenchmarking = false;
        return;
    }

    const maxBounds = state.map.options.maxBounds;

    for (const mode of modes) {
        setState('gpuRenderMode', mode);
        await renderMapDataAndMarkers();
        updateRendererStatus();
        fpsHistory = [];

        log(`Testing Mode: ${mode ? 'GPU (WebGL)' : 'CPU (Leaflet)'}...`);

        const testPoints = [];
        const validItems = allItems.filter(item => {
            const lat = parseFloat(item.x);
            const lng = parseFloat(item.y);
            return !maxBounds || maxBounds.contains([lat, lng]);
        });

        const sourceList = validItems.length > 0 ? validItems : allItems;
        const stepSize = Math.floor(sourceList.length / 8);

        for (let i = 0; i < 8; i++) {
            const item = sourceList[Math.min(i * stepSize + Math.floor(Math.random() * stepSize), sourceList.length - 1)];
            testPoints.push({
                center: [parseFloat(item.x), parseFloat(item.y)],
                zoom: 13 + Math.floor(Math.random() * 2),
                name: item.name
            });
        }

        for (let i = 0; i < testPoints.length; i++) {
            const point = testPoints[i];
            log(`Jumping to Content: "${point.name}" @ Zoom ${point.zoom}`);

            state.map.flyTo(point.center, point.zoom, {
                animate: true,
                duration: 1.5
            });

            await new Promise(r => setTimeout(r, 2500));
        }

        const avg = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
        const sorted = [...fpsHistory].sort((a, b) => a - b);
        const low = sorted[Math.max(0, Math.floor(fpsHistory.length * 0.01))];

        results.push({ mode: mode ? 'GPU' : 'CPU', avg, low });
        log(`${mode ? 'GPU' : 'CPU'} Analysis: Avg ${avg} FPS, 1% Low ${low} FPS`, "success");
    }

    if (autoCompare) {
        const cpu = results[0];
        const gpu = results[1];
        const diff = Math.round(((gpu.avg - cpu.avg) / cpu.avg) * 100);
        log(`--- PERFORMANCE COMPARISON ---`, "success");
        log(`GPU Gain: ${diff > 0 ? '+' : ''}${diff}%`);
        alert(`BENCHMARK COMPLETE\n\nCPU: ${cpu.avg} FPS\nGPU: ${gpu.avg} FPS\nGAIN: ${diff}%`);
    }

    isBenchmarking = false;
    startBtn.classList.remove('active');
    log("DYNAMIC TEST SEQUENCE COMPLETED", "success");
};

const runZoomTest = async () => {
    if (isBenchmarking) return;
    isBenchmarking = true;
    fpsHistory = [];
    log("ZOOM SEQUENCE INITIATED", "success");

    const zooms = [10, 11, 12, 13, 14, 13, 12, 11, 10];
    for (const z of zooms) {
        log(`Scaling to Zoom Level ${z}...`);
        state.map.setZoom(z, { animate: true });
        await new Promise(r => setTimeout(r, 1500));
    }

    isBenchmarking = false;
    log("ZOOM SEQUENCE COMPLETED", "success");
};

const runPanTest = async () => {
    if (isBenchmarking) return;
    isBenchmarking = true;
    fpsHistory = [];
    log("PANNING SEQUENCE INITIATED", "success");

    const center = state.map.getCenter();
    const offset = 0.05;
    const directions = [
        { name: "North", lat: center.lat + offset, lng: center.lng },
        { name: "East", lat: center.lat + offset, lng: center.lng + offset },
        { name: "South", lat: center.lat - offset, lng: center.lng + offset },
        { name: "West", lat: center.lat - offset, lng: center.lng - offset },
        { name: "Center", lat: center.lat, lng: center.lng }
    ];

    for (const d of directions) {
        log(`Panning Vector: ${d.name}...`);
        state.map.panTo([d.lat, d.lng], { animate: true, duration: 3.0 });
        await new Promise(r => setTimeout(r, 3500));
    }

    isBenchmarking = false;
    log("PANNING SEQUENCE COMPLETED", "success");
};

const updateRendererStatus = () => {
    const isGPU = state.gpuRenderMode;
    statusRenderer.textContent = isGPU ? 'WEBGL (PIXI)' : 'CANVAS (LEAFLET)';
    statusRenderer.style.color = isGPU ? '#ffbd53' : '#2196F3';
};

document.addEventListener('DOMContentLoaded', async () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (key, value) => {
        if (key.includes('wwm_active_') || key.includes('wwm_hide_completed') || key.includes('wwm_gpu_render')) {
            return;
        }
        originalSetItem.call(localStorage, key, value);
    };

    loadingBar.style.width = '20%';
    log("Kernel loading...");

    await loadMapData('qinghe');
    loadingBar.style.width = '50%';

    log("Forcing high-performance mode...");
    setState('hideCompleted', false);
    setState('activeCategoryIds', new Set(state.mapData.categories.map(c => c.id)));
    setState('activeRegionNames', new Set(state.uniqueRegions));

    loadingBar.style.width = '80%';

    log("Injecting markers into viewport...");
    await renderMapDataAndMarkers();
    updateRendererStatus();

    loadingBar.style.width = '100%';
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        log("SYSTEM READY. WAITING FOR COMMAND.", "success");
    }, 500);

    resizeCanvas();
    requestAnimationFrame(updateFPS);
});

cpuBtn.addEventListener('click', async () => {
    if (isBenchmarking) return;
    setState('gpuRenderMode', false);
    cpuBtn.classList.add('active');
    gpuBtn.classList.remove('active');
    log("Switched to CPU Renderer.");
    await renderMapDataAndMarkers();
    updateRendererStatus();
});

gpuBtn.addEventListener('click', async () => {
    if (isBenchmarking) return;
    setState('gpuRenderMode', true);
    gpuBtn.classList.add('active');
    cpuBtn.classList.remove('active');
    log("Switched to GPU Renderer.");
    await renderMapDataAndMarkers();
    updateRendererStatus();
});

startBtn.addEventListener('click', () => runStressTest(false));
document.getElementById('compare-bench').addEventListener('click', () => runStressTest(true));
document.getElementById('test-zoom').addEventListener('click', runZoomTest);
document.getElementById('test-pan').addEventListener('click', runPanTest);
