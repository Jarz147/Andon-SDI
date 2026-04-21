/**
 * Dashboard memanggil endpoint yang sama dengan flow Node-RED:
 * - GET /andon-mtc          → halaman (template)
 * - GET /andon-mtc/api/state → JSON { shiftKey, lines }
 * URL API dihitung relatif ke lokasi halaman (new URL('api/state', ...)).
 */

const CONFIG = {
    runningText: {
        enabled: true,
        text: 'ANDON MTC — monitoring downtime & akumulasi real-time — data terpusat Node-RED — PT Sankei Dharma Indonesia',
        speedSec: 40
    },
    soundOnAndon: true
};

var soundLinePrevOn = {};
var soundPollInitialized = false;

function getApiStateUrl() {
    if (typeof window.__ANDON_API_STATE__ === 'string' && window.__ANDON_API_STATE__.trim()) {
        return window.__ANDON_API_STATE__.trim();
    }
    return String(new URL('api/state', window.location.href));
}

const API_STATE_URL = getApiStateUrl();

function unlockAndonAudio() {
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!window.__andonAudioCtx) window.__andonAudioCtx = new AC();
        var ctx = window.__andonAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
}
function andonAudioUnlock() {
    unlockAndonAudio();
    document.removeEventListener('click', andonAudioUnlock, true);
    document.removeEventListener('touchstart', andonAudioUnlock, true);
}
document.addEventListener('click', andonAudioUnlock, true);
document.addEventListener('touchstart', andonAudioUnlock, { capture: true, passive: true });

function playAndonOnSound() {
    if (!CONFIG.soundOnAndon) return;
    try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!window.__andonAudioCtx) window.__andonAudioCtx = new AC();
        var ctx = window.__andonAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        var t0 = ctx.currentTime;
        function beep(freq, dur, delay) {
            var o = ctx.createOscillator();
            var g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, t0 + delay);
            g.gain.setValueAtTime(0.0001, t0 + delay);
            g.gain.exponentialRampToValueAtTime(0.14, t0 + delay + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
            o.connect(g);
            g.connect(ctx.destination);
            o.start(t0 + delay);
            o.stop(t0 + delay + dur);
        }
        beep(880, 0.2, 0);
        beep(1100, 0.18, 0.22);
    } catch (e) {}
}

function detectAndonOnSound(data) {
    if (!data || !data.lines) return;
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bending'];
    var anyNew = false;
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var line = data.lines[k];
        var nowOn = !!(line && line.on);
        if (soundPollInitialized && nowOn && !soundLinePrevOn[k]) anyNew = true;
    }
    if (anyNew) playAndonOnSound();
    for (var j = 0; j < keys.length; j++) {
        var k2 = keys[j];
        var ln = data.lines[k2];
        soundLinePrevOn[k2] = !!(ln && ln.on);
    }
    soundPollInitialized = true;
}

function initRunningText() {
    const wrap = document.getElementById('running-text-wrap');
    const inner = wrap && wrap.querySelector('.running-text-inner');
    const cfg = CONFIG.runningText;
    if (!wrap || !inner || !cfg || cfg.enabled === false) {
        if (wrap) wrap.classList.add('is-hidden');
        return;
    }
    const raw = (cfg.text != null ? String(cfg.text) : '').trim();
    if (!raw) {
        wrap.classList.add('is-hidden');
        return;
    }
    wrap.classList.remove('is-hidden');
    const speed = Math.max(6, Math.min(120, Number(cfg.speedSec) || 30));
    inner.style.animationDuration = speed + 's';
    inner.textContent = '';
    const seg = document.createElement('span');
    seg.className = 'running-text-seg';
    seg.textContent = '  •  ' + raw + '  •  ';
    inner.appendChild(seg);
    inner.appendChild(seg.cloneNode(true));
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatTime(s) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h + ':' + m + ':' + sec;
}

function formatLogDateTime(ms) {
    const d = new Date(ms);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' +
        pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

function renderLogEl(el, rows) {
    if (!el) return;
    if (!rows || rows.length === 0) {
        el.innerHTML = '<div class="text-zinc-600 italic truncate">—</div>';
        return;
    }
    var lim = 3;
    var short = rows.slice(0, lim);
    el.innerHTML = short.map(function (entry) {
        return '<div class="py-px border-b border-zinc-800/40 last:border-0 truncate">' +
            formatLogDateTime(entry.start).split(' ').pop() + '\u2192' + formatLogDateTime(entry.end).split(' ').pop() +
            ' ' + formatTime(entry.sec) + '</div>';
    }).join('');
}

function applyLineCard(line, prefix) {
    if (!line) return;
    const lamp = document.getElementById('lamp-' + prefix);
    const timerEl = document.getElementById('timer-' + prefix);
    const dailyEl = document.getElementById('daily-' + prefix);
    const freqEl = document.getElementById('freq-' + prefix);
    const logEl = document.getElementById('log-' + prefix);
    if (!lamp || !timerEl || !dailyEl || !logEl) return;
    if (line.on) {
        lamp.classList.remove('lamp-off');
        lamp.classList.add('lamp-on');
        timerEl.classList.remove('text-zinc-600');
        timerEl.classList.add('text-blue-400');
    } else {
        lamp.classList.remove('lamp-on');
        lamp.classList.add('lamp-off');
        timerEl.classList.remove('text-blue-400');
        timerEl.classList.add('text-zinc-600');
    }
    timerEl.innerText = formatTime(line.sessionSeconds);
    const dailyTotal = line.dailySeconds + (line.on ? line.sessionSeconds : 0);
    dailyEl.innerText = formatTime(dailyTotal);
    if (freqEl) freqEl.innerText = String(line.frequency != null ? line.frequency : 0);
    renderLogEl(logEl, line.log || []);
}

function applyServerState(data) {
    if (!data || !data.lines) return;
    detectAndonOnSound(data);
    for (let i = 1; i <= 9; i++) {
        applyLineCard(data.lines[String(i)], 'assy' + i);
    }
    applyLineCard(data.lines.bending, 'bending');
}

async function pullState() {
    try {
        const r = await fetch(API_STATE_URL, { cache: 'no-store', credentials: 'same-origin' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        applyServerState(data);
        var el = document.getElementById('conn-status');
        el.innerText = 'ONLINE · NODE-RED';
        el.className = 'app-status text-green-500 uppercase shrink-0 w-full sm:w-auto text-left sm:text-right sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4';
    } catch (e) {
        const msg = (e && e.message) ? String(e.message) : 'fetch gagal';
        var el = document.getElementById('conn-status');
        el.innerText = 'ERROR: ' + msg;
        el.className = 'app-status text-red-500 uppercase shrink-0 w-full sm:w-auto text-left sm:text-right sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4 max-w-[min(100%,320px)] break-words';
    }
}

function buildDashboardCards() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    var html = '';
    for (let i = 1; i <= 9; i++) {
        html += '<div class="andon-card flex flex-col items-stretch shadow-lg w-full h-full overflow-hidden p-1 sm:p-1.5 xl:p-2 2xl:p-3 gap-0.5 xl:gap-1">' +
            '<span class="text-xs sm:text-sm xl:text-base 2xl:text-lg text-center shrink-0 leading-tight truncate text-zinc-200">' +
            '<span class="xl:hidden">ASSY ' + i + '</span><span class="hidden xl:inline">ANDON LINE ASSY ' + i + '</span>' +
            '</span>' +
            '<div id="lamp-assy' + i + '" class="lamp lamp-off w-full shrink-0"></div>' +
            '<div class="text-center w-full min-w-0 shrink-0">' +
            '<div id="timer-assy' + i + '" class="text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-zinc-600 tabular-nums leading-none">00:00:00</div>' +
            '<p class="text-[9px] sm:text-[10px] xl:text-xs text-blue-500 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Downtime</p>' +
            '<div id="daily-assy' + i + '" class="text-sm sm:text-base xl:text-lg 2xl:text-xl font-digital text-amber-500 mt-0.5 xl:mt-1 tabular-nums leading-none">00:00:00</div>' +
            '<p class="text-[9px] sm:text-[10px] xl:text-xs text-amber-600 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Akumulasi / hari (06:00)</p>' +
            '<div id="freq-assy' + i + '" class="text-sm sm:text-base xl:text-lg 2xl:text-xl font-digital text-emerald-400 mt-0.5 xl:mt-1 tabular-nums leading-none">0</div>' +
            '<p class="text-[9px] sm:text-[10px] xl:text-xs text-emerald-500/90 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Frekuensi andon (06:00)</p>' +
            '</div>' +
            '<div class="w-full flex flex-col flex-shrink-0 mt-0.5 xl:mt-1">' +
            '<p class="text-[9px] sm:text-[10px] xl:text-xs text-zinc-500 uppercase mb-0.5 xl:mb-1 text-left shrink-0" style="font-weight: 700 !important;">Log downtime</p>' +
            '<div id="log-assy' + i + '" class="log-scroll rounded border border-zinc-800 bg-black/50 px-1 py-0.5 xl:px-1.5 xl:py-1 text-left text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm font-mono text-zinc-400 leading-tight break-words"></div>' +
            '</div>' +
            '</div>';
    }
    html += '<div class="andon-card flex flex-col items-stretch shadow-lg w-full h-full overflow-hidden p-1 sm:p-1.5 xl:p-2 2xl:p-3 gap-0.5 xl:gap-1 border-amber-900/40">' +
        '<span class="text-xs sm:text-sm xl:text-base 2xl:text-lg text-center shrink-0 leading-tight truncate text-amber-200">' +
        '<span class="xl:hidden">BENDING</span><span class="hidden xl:inline">ANDON LINE BENDING</span>' +
        '</span>' +
        '<div id="lamp-bending" class="lamp lamp-off w-full shrink-0"></div>' +
        '<div class="text-center w-full min-w-0 shrink-0">' +
        '<div id="timer-bending" class="text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-zinc-600 tabular-nums leading-none">00:00:00</div>' +
        '<p class="text-[9px] sm:text-[10px] xl:text-xs text-blue-500 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Downtime</p>' +
        '<div id="daily-bending" class="text-sm sm:text-base xl:text-lg 2xl:text-xl font-digital text-amber-500 mt-0.5 xl:mt-1 tabular-nums leading-none">00:00:00</div>' +
        '<p class="text-[9px] sm:text-[10px] xl:text-xs text-amber-600 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Akumulasi / hari (06:00)</p>' +
        '<div id="freq-bending" class="text-sm sm:text-base xl:text-lg 2xl:text-xl font-digital text-emerald-400 mt-0.5 xl:mt-1 tabular-nums leading-none">0</div>' +
        '<p class="text-[9px] sm:text-[10px] xl:text-xs text-emerald-500/90 uppercase mt-0.5 xl:mt-1" style="font-weight: 700 !important;">Frekuensi andon (06:00)</p>' +
        '</div>' +
        '<div class="w-full flex flex-col flex-shrink-0 mt-0.5 xl:mt-1">' +
        '<p class="text-[9px] sm:text-[10px] xl:text-xs text-zinc-500 uppercase mb-0.5 xl:mb-1 text-left shrink-0" style="font-weight: 700 !important;">Log downtime</p>' +
        '<div id="log-bending" class="log-scroll rounded border border-zinc-800 bg-black/50 px-1 py-0.5 xl:px-1.5 xl:py-1 text-left text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm font-mono text-zinc-400 leading-tight break-words"></div>' +
        '</div>' +
        '</div>';
    grid.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function () {
    buildDashboardCards();
    initRunningText();
    setInterval(pullState, 1000);
    pullState();
});
