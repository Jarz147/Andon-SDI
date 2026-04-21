// Broker EMQX Cloud (WebSocket) — selaras dengan node "EMQX public" / mqtt out di Node-RED
const MQTT_CONFIG = {
    host: 'x914fb68.ala.eu-central-1.emqxsl.com',
    port: 8084,
    path: '/mqtt',
    username: 'Jarz147',
    password: 'Sankei2022!',
};

/** Topik sama seperti flow Node-RED (MQTT in + bending wildcard) */
function buildAndonTopics() {
    const topics = [];
    for (let i = 1; i <= 9; i++) topics.push(`/assy${i}/andon/mtc`);
    topics.push('/bending/andon/mtc', '/bending/+/andon/mtc');
    return topics;
}

/** Parsing sama seperti function "andon MQTT + tick" di Node-RED */
function lineIdFromTopic(topic) {
    const t = String(topic).replace(/^\/+/, '');
    const mAssy = t.match(/^assy(\d+)\/andon\/mtc$/i);
    if (mAssy) return mAssy[1];
    if (/^bending\/assy\d+\/andon\/mtc$/i.test(t) || /^bending\/andon\/mtc$/i.test(t)) return 'bending';
    return null;
}

function addLog(text) {
    const el = document.getElementById('logs');
    if (!el) return;
    const line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' — ' + text;
    el.prepend(line);
    while (el.children.length > 40) el.removeChild(el.lastChild);
}

function setLineState(lineId, isOn) {
    const badge = document.getElementById('state-' + lineId);
    const card = document.querySelector('.line-card[data-line="' + lineId + '"]');
    if (badge) {
        badge.textContent = isOn ? 'ON' : 'OFF';
        badge.className = 'line-state ' + (isOn ? 'on' : 'off');
    }
    if (card) card.classList.toggle('active', isOn);
}

const clientId = 'web_andon_sdi_' + Math.random().toString(16).substring(2, 10);

const options = {
    keepalive: 60,
    clientId: clientId,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    rejectUnauthorized: false,
};

const connectUrl = `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`;
const ANDON_TOPICS = buildAndonTopics();

console.log('Menghubungkan ke:', connectUrl);

const client = mqtt.connect(connectUrl, options);

client.on('connect', () => {
    console.log('Terhubung');
    const badge = document.getElementById('status-badge');
    if (badge) {
        badge.textContent = 'Connected';
        badge.className = 'badge connected';
    }
    client.subscribe(ANDON_TOPICS, { qos: 0 }, (err) => {
        if (err) {
            addLog('Subscribe error: ' + err.message);
            return;
        }
        addLog('Subscribe: ' + ANDON_TOPICS.length + ' topik andon/mtc');
    });
});

client.on('message', (topic, payload) => {
    const raw = (payload && payload.toString) ? payload.toString() : String(payload);
    const status = raw.toUpperCase().trim();
    const lineId = lineIdFromTopic(topic);
    const topicEl = document.getElementById('topic-display');
    const msgEl = document.getElementById('message-display');
    if (topicEl) topicEl.textContent = topic;
    if (msgEl) msgEl.textContent = raw || '(kosong)';

    if (!lineId) return;
    if (status === 'ON') setLineState(lineId, true);
    else if (status === 'OFF') setLineState(lineId, false);
});

client.on('error', (err) => {
    console.error(err);
    addLog('Error: ' + err.message);
});

client.on('close', () => {
    const badge = document.getElementById('status-badge');
    if (badge) {
        badge.textContent = 'Disconnected';
        badge.className = 'badge disconnected';
    }
    addLog('Koneksi tertutup');
});

client.on('reconnect', () => {
    addLog('Mencoba reconnect…');
});
