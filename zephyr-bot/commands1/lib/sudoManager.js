'use strict';

const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '..', '..', 'data', 'sudo.json');

function readList() {
    try {
        const value = JSON.parse(fs.readFileSync(STORE, 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function writeList(list) {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify([...new Set(list)], null, 2));
}

function normalize(jid) {
    return String(jid || '').trim().toLowerCase();
}

async function isSudo(jid) {
    return readList().map(normalize).includes(normalize(jid));
}

async function addSudo(jid) {
    const value = normalize(jid);
    if (!value) return false;
    const list = readList();
    if (list.map(normalize).includes(value)) return false;
    list.push(value);
    writeList(list);
    return true;
}

async function removeSudo(jid) {
    const value = normalize(jid);
    const next = readList().filter(item => normalize(item) !== value);
    const changed = next.length !== readList().length;
    writeList(next);
    return changed;
}

function getSudoList() {
    return readList();
}

module.exports = { isSudo, addSudo, removeSudo, getSudoList };
