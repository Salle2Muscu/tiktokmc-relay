const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Stocke les connexions Minecraft par clé de licence
const minecraftClients = new Map(); // licenseKey → WebSocket

// ── Plugin Minecraft se connecte ──
wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const licenseKey = params.get('key');

    if (!licenseKey) { ws.close(); return; }

    console.log(`[Relay] Plugin connecté avec clé : ${licenseKey}`);
    minecraftClients.set(licenseKey, ws);

    ws.on('close', () => {
        console.log(`[Relay] Plugin déconnecté : ${licenseKey}`);
        minecraftClients.delete(licenseKey);
    });
});

// ── Launcher envoie un event ──
app.post('/event', (req, res) => {
    const { license_key, ...eventData } = req.body;

    if (!license_key) {
        return res.status(400).json({ error: 'license_key manquant' });
    }

    const client = minecraftClients.get(license_key);

    if (!client || client.readyState !== WebSocket.OPEN) {
        return res.status(404).json({ error: 'Plugin Minecraft non connecté' });
    }

    client.send(JSON.stringify(eventData));
    console.log(`[Relay] Event envoyé à ${license_key} : ${eventData.event}`);
    res.json({ success: true });
});

// ── Health check ──
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        connected: minecraftClients.size
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Relay] Serveur démarré sur le port ${PORT}`);
});
