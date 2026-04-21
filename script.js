// 1. Konfigurasi Koneksi EMQX Cloud
const MQTT_CONFIG = {
    url: 'wss://x914fb68.ala.eu-central-1.emqxsl.com:8084/mqtt',
    options: {
        username: 'Jarz147',
        password: 'Sankei2022!',
        clientId: 'web_andon_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 4000
    }
};

// 2. Inisialisasi Data State (Mirip logika global Node-RED Anda)
let andonState = {
    lines: {}
};

// Buat struktur data untuk Assy 1-9 dan Bending
const lineKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bending'];
lineKeys.forEach(k => {
    andonState.lines[k] = {
        on: false,
        sessionSeconds: 0,
        dailySeconds: 0,
        frequency: 0,
        log: [],
        sessionStart: null
    };
});

// 3. Fungsi Helper
const formatTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
};

// 4. Koneksi MQTT
const client = mqtt.connect(MQTT_CONFIG.url, MQTT_CONFIG.options);

client.on('connect', () => {
    console.log("✅ Terhubung ke EMQX Cloud");
    document.getElementById('conn-status').innerText = "ONLINE • CLOUD";
    document.getElementById('conn-status').className = "app-status text-green-500 uppercase";
    
    // Subscribe ke semua topik andon mtc
    // Sesuai JSON Node-RED: /assy1/andon/mtc, /bending/andon/mtc, dll
    client.subscribe('/+/andon/mtc');
});

client.on('message', (topic, message) => {
    const payload = message.toString().toUpperCase().trim();
    // Ambil ID line dari topik (contoh: /assy1/andon/mtc -> assy1)
    const topicParts = topic.split('/');
    let id = topicParts[1].replace('assy', ''); // jadi '1', '2', atau 'bending'

    const line = andonState.lines[id];
    if (!line) return;

    if (payload === 'ON') {
        if (!line.on) {
            line.on = true;
            line.sessionStart = Date.now();
            line.sessionSeconds = 0;
            console.log(`Line ${id} ON`);
        }
    } else if (payload === 'OFF') {
        if (line.on) {
            line.dailySeconds += line.sessionSeconds;
            line.frequency += 1;
            
            // Tambahkan ke log (ambil 3 teratas saja untuk UI)
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            line.log.unshift(`${timeStr} | ${formatTime(line.sessionSeconds)}`);
            if (line.log.length > 3) line.log.pop();

            line.on = false;
            line.sessionSeconds = 0;
            line.sessionStart = null;
            console.log(`Line ${id} OFF`);
        }
    }
});

// 5. Loop Interval 1 Detik (Real-time Ticking)
setInterval(() => {
    lineKeys.forEach(k => {
        const line = andonState.lines[k];
        const prefix = k === 'bending' ? 'bending' : 'assy' + k;

        // Jika ON, tambahkan detik session
        if (line.on) {
            line.sessionSeconds++;
            // Update UI Lampu & Timer Biru
            updateUIElement(`lamp-${prefix}`, 'lamp-on', 'lamp-off');
            updateUIElement(`timer-${prefix}`, 'text-blue-400', 'text-zinc-600', formatTime(line.sessionSeconds));
        } else {
            updateUIElement(`lamp-${prefix}`, 'lamp-off', 'lamp-on');
            updateUIElement(`timer-${prefix}`, 'text-zinc-600', 'text-blue-400', "00:00:00");
        }

        // Update Akumulasi & Frekuensi
        const totalDaily = line.dailySeconds + (line.on ? line.sessionSeconds : 0);
        document.getElementById(`daily-${prefix}`).innerText = formatTime(totalDaily);
        document.getElementById(`freq-${prefix}`).innerText = line.frequency;

        // Update Log
        const logEl = document.getElementById(`log-${prefix}`);
        if (line.log.length > 0) {
            logEl.innerHTML = line.log.map(item => `<div class="border-b border-zinc-800/40">${item}</div>`).join('');
        } else {
            logEl.innerHTML = '<div class="text-zinc-600 italic">—</div>';
        }
    });
}, 1000);

// Helper Fungsi UI
function updateUIElement(id, addClass, removeClass, text = null) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add(addClass);
    el.classList.remove(removeClass);
    if (text !== null) el.innerText = text;
}
