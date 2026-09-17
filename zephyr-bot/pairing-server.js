require('./config');

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pairSystem = require('./pair');
const { cleanPhoneNumber } = require('./helper');

const app = express();
const PORT = Number(process.env.PAIRING_PORT || process.env.PORT || 15449);
const API_KEY = String(process.env.PAIRING_API_KEY || '');
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map();
const serverStartedAt = Date.now();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getClientKey(req) {
    return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .split(',')[0].trim();
}

function checkRateLimit(req, res, next) {
    const key = getClientKey(req);
    const now = Date.now();
    const existing = rateBuckets.get(key) || { startedAt: now, count: 0 };
    if (now - existing.startedAt >= RATE_LIMIT_WINDOW_MS) {
        existing.startedAt = now;
        existing.count = 0;
    }
    existing.count += 1;
    rateBuckets.set(key, existing);
    if (existing.count > RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - existing.startedAt)) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'Too many pairing requests. Try again later.' });
    }
    next();
}

function requireApiKey(req, res, next) {
    if (!API_KEY) {
        return res.status(503).json({ error: 'Pairing server is not configured. Set PAIRING_API_KEY.' });
    }
    const supplied = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!safeEqual(supplied, API_KEY)) return res.status(401).json({ error: 'Unauthorized.' });
    next();
}

function validateNumber(input) {
    const number = cleanPhoneNumber(input || '');
    if (!number || number.length < 8 || number.length > 15) {
        return { error: 'Use a full WhatsApp number with country code, digits only.' };
    }
    return { number };
}

app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'zephyr-md-pairing', uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000) });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/pair/status', requireApiKey, (req, res) => {
    const checked = validateNumber(req.query.number);
    if (checked.error) return res.status(400).json(checked);
    res.json({ number: checked.number, status: pairSystem.getSessionStatus(checked.number) });
});

app.post('/api/pair', requireApiKey, checkRateLimit, async (req, res) => {
    const checked = validateNumber(req.body?.number);
    if (checked.error) return res.status(400).json(checked);
    try {
        const result = await pairSystem.addWebPair(checked.number, null);
        if (result.error) return res.status(409).json({ error: result.error });
        return res.status(200).json({
            ok: true,
            number: result.number,
            code: result.code,
            status: pairSystem.getSessionStatus(result.number),
            message: 'Enter this code in WhatsApp Linked Devices before it expires.'
        });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Pairing request failed.' });
    }
});

app.delete('/api/pair', requireApiKey, async (req, res) => {
    const checked = validateNumber(req.body?.number || req.query.number);
    if (checked.error) return res.status(400).json(checked);
    const result = await pairSystem.delPair(checked.number, null, true);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json({ ok: true, number: result.number, status: 'removed' });
});

app.get('/api/pairs', requireApiKey, (req, res) => {
    res.json({ pairs: pairSystem.listPairs(null, true) });
});

const server = app.listen(PORT, async () => {
    if (!API_KEY) console.warn('⚠️ PAIRING_API_KEY is not set; pairing routes are disabled.');
    console.log(`🚀 SKYBLUE-MD pairing server listening on port ${PORT}`);
    await pairSystem.restorePairs(null);
});

async function shutdown(signal) {
    console.log(`Received ${signal}; closing pairing server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
