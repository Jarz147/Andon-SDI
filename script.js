// Konfigurasi Kredensial
const MQTT_CONFIG = {
    host: 'x914fb68.ala.eu-central-1.emqxsl.com',
    port: 8084,
    path: '/mqtt',
    username: 'Jarz147',
    password: 'Sankei2022!',
};

// Buat Client ID unik agar tidak bentrok dengan MQTTX
const clientId = 'web_client_' + Math.random().toString(16).substring(2, 10);

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
    rejectUnauthorized: false // Abaikan masalah sertifikat SSL pada browser tertentu
};

// Gabungkan URL lengkap untuk WebSockets
const connectUrl = `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`;

console.log('Menghubungkan ke:', connectUrl);

// Inisialisasi koneksi
const client = mqtt.connect(connectUrl, options);

client.on('connect', () => {
    console.log('✅ Berhasil Terhubung!');
    document.getElementById('status-badge').innerText = "Connected";
    document.getElementById('status-badge').className = "badge connected";
    
    // Subscribe ke topik (sesuaikan topik Anda)
    client.subscribe('factory/data', (err) => {
        if (!err) console.log('Subscribed ke factory/data');
    });
});

client.on('error', (err) => {
    console.error('❌ Gagal koneksi:', err);
    // Jika muncul error, tampilkan di log dashboard agar mudah dipantau
    if (typeof addLog === "function") addLog("Error: " + err.message);
});

client.on('close', () => {
    console.log('⚠️ Koneksi terputus');
});
