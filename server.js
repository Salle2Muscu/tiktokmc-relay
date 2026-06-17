const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const minecraftClients = new Map();

// ═══════════════════════════════════════════════
// WebSocket — Plugin connections
// ═══════════════════════════════════════════════
wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const licenseKey = params.get('key');
    if (!licenseKey) { ws.close(); return; }

    console.log(`[Relay] Plugin connecté : ${licenseKey}`);
    ws.isAlive = true;
    minecraftClients.set(licenseKey, ws);

    // Respond to pong frames (WebSocket level)
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Handle JSON messages from plugin (ping keepalive)
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (e) {
            // Not JSON, ignore
        }
    });

    ws.on('close', () => {
        console.log(`[Relay] Plugin déconnecté : ${licenseKey}`);
        minecraftClients.delete(licenseKey);
    });

    ws.on('error', (err) => {
        console.log(`[Relay] Erreur WebSocket : ${err.message}`);
        minecraftClients.delete(licenseKey);
    });
});

// ═══════════════════════════════════════════════
// Heartbeat — ping all clients every 20 seconds
// Clients that don't respond get terminated
// ═══════════════════════════════════════════════
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('[Relay] Client inactif, déconnexion...');
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping(); // WebSocket level ping
    });
}, 20000); // every 20 seconds

wss.on('close', () => clearInterval(heartbeatInterval));

// ═══════════════════════════════════════════════
// HTTP — Receive events from launcher
// ═══════════════════════════════════════════════
app.post('/event', (req, res) => {
    const eventData = req.body;

    // Ignore ping events from plugins
    if (eventData.type === 'ping') {
        return res.json({ success: true, sent: 0 });
    }

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
    res.json({
        status: 'ok',
        connected: minecraftClients.size,
        clients: [...minecraftClients.keys()]
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Relay] Serveur démarré sur le port ${PORT}`);
});
