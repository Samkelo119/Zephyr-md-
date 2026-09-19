require('./config');

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const pairSystem = require('./pair');
const { cleanPhoneNumber, countFeatures } = require('./helper');

const app = express();
const PORT = Number(process.env.PAIRING_PORT || process.env.PORT || 15449);
const API_KEY = String(process.env.PAIRING_API_KEY || '');

// Rate limiting: one window for the public browser website, one for the API.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const WEB_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const WEB_RATE_LIMIT_MAX = 8;
const apiRateBuckets = new Map();
const webRateBuckets = new Map();
const serverStartedAt = Date.now();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.disable('etag');
app.use(express.json({ limit: '16kb' }));

// Baseline security + performance headers on every response.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    next();
});

// Serve static assets with long-lived caching for speed.
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    etag: true,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getClientKey(req) {
    return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .split(',')[0].trim();
}

function makeRateLimiter(buckets, windowMs, max, label) {
    return function rateLimit(req, res, next) {
        const key = getClientKey(req);
        const now = Date.now();
        const existing = buckets.get(key) || { startedAt: now, count: 0 };
        if (now - existing.startedAt >= windowMs) {
            existing.startedAt = now;
            existing.count = 0;
        }
        existing.count += 1;
        buckets.set(key, existing);
        if (existing.count > max) {
            const retryAfter = Math.ceil((windowMs - (now - existing.startedAt)) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ error: 'Too many ' + label + ' requests. Please wait a moment and try again.' });
        }
        next();
    };
}

const apiRateLimit = makeRateLimiter(apiRateBuckets, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, 'pairing');
const webRateLimit = makeRateLimiter(webRateBuckets, WEB_RATE_LIMIT_WINDOW_MS, WEB_RATE_LIMIT_MAX, 'pairing');

// Periodically drop stale rate-limit buckets so memory stays flat under load.
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of apiRateBuckets) {
        if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) apiRateBuckets.delete(key);
    }
    for (const [key, bucket] of webRateBuckets) {
        if (now - bucket.startedAt >= WEB_RATE_LIMIT_WINDOW_MS) webRateBuckets.delete(key);
    }
}, 5 * 60 * 1000).unref();

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

/* -------------------------------------------------------------------------- */
/*  Public browser routes (no API key) — these power the pairing website.      */
/*  Protected by rate limiting and input validation only, safe to call from    */
/*  the front-end without exposing the private PAIRING_API_KEY.                 */
/* -------------------------------------------------------------------------- */

app.post('/api/web/pair', webRateLimit, async (req, res) => {
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
            message: 'Enter this code in WhatsApp → Linked Devices before it expires.'
        });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Pairing request failed. Please try again.' });
    }
});

app.get('/api/web/status', (req, res) => {
    const checked = validateNumber(req.query.number);
    if (checked.error) return res.json({ status: 'idle' });
    res.json({ number: checked.number, status: pairSystem.getSessionStatus(checked.number) });
});

app.get('/api/web/stats', (req, res) => {
    const stats = pairSystem.getStats();
    res.json({
        totalPairs: stats.total,
        onlinePairs: stats.online,
        offlinePairs: stats.offline,
        uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
        totalFeatures: countFeatures(),
        countries: pairSystem.getCountryStats()
    });
});

/* -------------------------------------------------------------------------- */
/*  API-key protected routes — for programmatic / server-to-server access.      */
/* -------------------------------------------------------------------------- */

app.get('/api/pair/status', requireApiKey, (req, res) => {
    const checked = validateNumber(req.query.number);
    if (checked.error) return res.status(400).json(checked);
    res.json({ number: checked.number, status: pairSystem.getSessionStatus(checked.number) });
});

app.post('/api/pair', requireApiKey, apiRateLimit, async (req, res) => {
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
    if (!API_KEY) console.warn('⚠️ PAIRING_API_KEY is not set; the key-protected API routes are disabled (the public website still works).');
    console.log(`🚀 ${global.botname} pairing server listening on port ${PORT}`);
    try {
        await pairSystem.restorePairs(null);
    } catch (error) {
        console.error('⚠️ Failed to restore existing pairs:', error.message || error);
    }
});

// Tune the HTTP server for many small, fast pairing requests.
server.keepAliveTimeout = 30000;
server.headersTimeout = 35000;
server.requestTimeout = 60000;

async function shutdown(signal) {
    console.log(`Received ${signal}; closing pairing server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
