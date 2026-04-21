// Konfigurasi koneksi dari gambar yang Anda berikan
const options = {
    protocol: 'wss',
    hostname: 'x914fb68.ala.eu-central-1.emqxsl.com',
    port: 8084,
    path: '/mqtt',
    username: 'Jarz147',
    password: 'Sankei2017',
    clientId: 'web_client_' + Math.random().toString(16).substr(2, 8)
};

const statusBadge = document.getElementById('status-badge');
const logsContainer = document.getElementById('logs');

function addLog(msg) {
    const p = document.createElement('p');
    p.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
    logsContainer.prepend(p);
}

// Inisialisasi Koneksi
const client = mqtt.connect(options);

client.on('connect', () => {
    statusBadge.innerText = "Connected";
    statusBadge.classList.replace('disconnected', 'connected');
    addLog("Berhasil terhubung ke EMQX Cloud");

    // Ganti 'test/topic' dengan topik yang Anda gunakan di ESP32/Industrial tools
    const targetTopic = 'factory/data'; 
    client.subscribe(targetTopic);
    document.getElementById('topic-display').innerText = targetTopic;
});

client.on('message', (topic, message) => {
    document.getElementById('message-display').innerText = message.toString();
    addLog(`Data diterima di ${topic}`);
});

client.on('error', (err) => {
    addLog("Error: " + err.message);
    console.error(err);
});

client.on('close', () => {
    statusBadge.innerText = "Disconnected";
    statusBadge.classList.replace('connected', 'disconnected');
});
