const CONFIG = {
    mqtt: {
        host: 'x914fb68.ala.eu-central-1.emqxsl.com',
        port: 8084,
        path: '/mqtt',
        username: 'Jarz147',
        password: 'Sankei2022!',
        topics: [
            '/assy1/andon/mtc',
            '/assy2/andon/mtc',
            '/assy3/andon/mtc',
            '/assy4/andon/mtc',
            '/assy5/andon/mtc',
            '/assy6/andon/mtc',
            '/assy7/andon/mtc',
            '/assy8/andon/mtc',
            '/assy9/andon/mtc',
            '/bending/andon/mtc',
            '/bending/+/andon/mtc'
        ]
    },
    runningText: {
        enabled: true,
        text: 'ANDON MTC — indikator lampu real-time ON/OFF — sumber data MQTT EMQX',
        speedSec: 40
    }
};

const LINE_KEYS = ['assy1', 'assy2', 'assy3', 'assy4', 'assy5', 'assy6', 'assy7', 'assy8', 'assy9', 'bending'];
const lineStates = {};

function formatTime(totalSec) {
    const safe = Math.max(0, Number(totalSec) || 0);
    const h = Math.floor(safe / 3600).toString().padStart(2, '0');
    const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(safe % 60).toString().padStart(2, '0');
    return h + ':' + m + ':' + s;
}

function updateTimerEl(prefix) {
    const timerEl = document.getElementById('timer-' + prefix);
    if (!timerEl) return;
    const state = lineStates[prefix] || { on: false, startMs: 0 };
    if (!state.on) {
        timerEl.innerText = '00:00:00';
        timerEl.className = 'text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-zinc-600 tabular-nums leading-none mt-1 text-center';
        return;
    }
    const sec = Math.floor((Date.now() - state.startMs) / 1000);
    timerEl.innerText = formatTime(sec);
    timerEl.className = 'text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-blue-400 tabular-nums leading-none mt-1 text-center';
}

function refreshAllTimers() {
    for (let i = 0; i < LINE_KEYS.length; i++) {
        updateTimerEl(LINE_KEYS[i]);
    }
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

function applyLampState(prefix, isOn) {
    const lamp = document.getElementById('lamp-' + prefix);
    const stateEl = document.getElementById('state-' + prefix);
    if (!lamp) return;
    if (isOn) {
        lamp.classList.remove('lamp-off');
        lamp.classList.add('lamp-on');
    } else {
        lamp.classList.remove('lamp-on');
        lamp.classList.add('lamp-off');
    }
    if (stateEl) {
        stateEl.innerText = isOn ? 'ON' : 'OFF';
        stateEl.className = isOn
            ? 'text-xs sm:text-sm xl:text-base text-blue-400 uppercase mt-1'
            : 'text-xs sm:text-sm xl:text-base text-zinc-600 uppercase mt-1';
    }
    const prev = lineStates[prefix] || { on: false, startMs: 0 };
    if (isOn && !prev.on) {
        lineStates[prefix] = { on: true, startMs: Date.now() };
    } else if (!isOn) {
        lineStates[prefix] = { on: false, startMs: 0 };
    }
    updateTimerEl(prefix);
}

function lineKeyFromTopic(topic) {
    const t = String(topic || '').replace(/^\/+/, '');
    const assy = t.match(/^assy(\d+)\/andon\/mtc$/i);
    if (assy) return 'assy' + assy[1];
    if (/^bending\/andon\/mtc$/i.test(t) || /^bending\/assy\d+\/andon\/mtc$/i.test(t)) return 'bending';
    return '';
}

function connectMqtt() {
    if (typeof mqtt === 'undefined') {
        const missing = document.getElementById('conn-status');
        if (missing) missing.innerText = 'ERROR: MQTT LIB NOT LOADED';
        return;
    }
    const connectUrl = 'wss://' + CONFIG.mqtt.host + ':' + CONFIG.mqtt.port + CONFIG.mqtt.path;
    const options = {
        keepalive: 60,
        clientId: 'web_andon_public_' + Math.random().toString(16).slice(2, 10),
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 30 * 1000,
        username: CONFIG.mqtt.username,
        password: CONFIG.mqtt.password
    };

    const client = mqtt.connect(connectUrl, options);

    client.on('connect', function () {
        const ok = document.getElementById('conn-status');
        if (ok) {
            ok.innerText = 'ONLINE · MQTT';
            ok.className = 'app-status text-green-500 uppercase shrink-0 w-full sm:w-auto text-left sm:text-right sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4';
        }
        client.subscribe(CONFIG.mqtt.topics, { qos: 0 });
    });

    client.on('message', function (topic, payload) {
        const key = lineKeyFromTopic(topic);
        if (!key) return;
        const raw = (payload && payload.toString ? payload.toString() : String(payload)).trim().toUpperCase();
        applyLampState(key, raw === 'ON');
    });

    client.on('reconnect', function () {
        const wait = document.getElementById('conn-status');
        if (wait) wait.innerText = 'RECONNECTING...';
    });

    client.on('error', function (err) {
        const fail = document.getElementById('conn-status');
        if (fail) {
            fail.innerText = 'ERROR: ' + (err && err.message ? err.message : 'mqtt');
            fail.className = 'app-status text-red-500 uppercase shrink-0 w-full sm:w-auto text-left sm:text-right sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4';
        }
    });

    client.on('close', function () {
        const close = document.getElementById('conn-status');
        if (close) {
            close.innerText = 'DISCONNECTED';
            close.className = 'app-status text-red-500 uppercase shrink-0 w-full sm:w-auto text-left sm:text-right sm:absolute sm:top-1/2 sm:-translate-y-1/2 sm:right-4';
        }
    });
}

function buildDashboardCards() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    var html = '';
    for (let i = 1; i <= 9; i++) {
        html += '<div class="andon-card flex flex-col items-stretch justify-between shadow-lg w-full h-full overflow-hidden p-2 xl:p-3">' +
            '<span class="text-xs sm:text-sm xl:text-base 2xl:text-lg text-center shrink-0 leading-tight truncate text-zinc-200">' +
            '<span class="xl:hidden">ASSY ' + i + '</span><span class="hidden xl:inline">ANDON LINE ASSY ' + i + '</span>' +
            '</span>' +
            '<div id="lamp-assy' + i + '" class="lamp lamp-off w-full shrink-0"></div>' +
            '<p class="text-[9px] sm:text-[10px] xl:text-xs text-blue-500 uppercase mt-1 text-center">Downtime</p>' +
            '<div id="timer-assy' + i + '" class="text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-zinc-600 tabular-nums leading-none mt-1 text-center">00:00:00</div>' +
            '<p id="state-assy' + i + '" class="text-xs sm:text-sm xl:text-base text-zinc-600 uppercase mt-1 text-center">OFF</p>' +
            '</div>';
    }
    html += '<div class="andon-card flex flex-col items-stretch justify-between shadow-lg w-full h-full overflow-hidden p-2 xl:p-3 border-amber-900/40">' +
        '<span class="text-xs sm:text-sm xl:text-base 2xl:text-lg text-center shrink-0 leading-tight truncate text-amber-200">' +
        '<span class="xl:hidden">BENDING</span><span class="hidden xl:inline">ANDON LINE BENDING</span>' +
        '</span>' +
        '<div id="lamp-bending" class="lamp lamp-off w-full shrink-0"></div>' +
        '<p class="text-[9px] sm:text-[10px] xl:text-xs text-blue-500 uppercase mt-1 text-center">Downtime</p>' +
        '<div id="timer-bending" class="text-base sm:text-lg md:text-xl xl:text-2xl 2xl:text-3xl font-digital text-zinc-600 tabular-nums leading-none mt-1 text-center">00:00:00</div>' +
        '<p id="state-bending" class="text-xs sm:text-sm xl:text-base text-zinc-600 uppercase mt-1 text-center">OFF</p>' +
        '</div>';
    grid.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function () {
    buildDashboardCards();
    for (let i = 0; i < LINE_KEYS.length; i++) lineStates[LINE_KEYS[i]] = { on: false, startMs: 0 };
    setInterval(refreshAllTimers, 1000);
    initRunningText();
    connectMqtt();
});
