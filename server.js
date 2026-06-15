const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const minecraftClients = new Map();

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

// Launcher envoie un event → on broadcast à TOUS les plugins connectés
app.post('/event', (req, res) => {
    const eventData = req.body;

    let sent = 0;
    minecraftClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(eventData));
            sent++;
        }
    });

    console.log(`[Relay] Event ${eventData.event} envoyé à ${sent} plugins`);
    res.json({ success: true, sent });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', connected: minecraftClients.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Relay] Serveur démarré sur le port ${PORT}`);
});
