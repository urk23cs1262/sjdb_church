/**
 * Static regression checks for the 24/7 daemon architecture.
 * Run with: node src/test_247_daemon_architecture.js
 *
 * This does not contact WhatsApp/MongoDB. It verifies that the deployed
 * entry points cannot silently fall back to the old admin-page lifecycle.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const backendRoot = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const legacyEntry = fs.readFileSync(path.join(backendRoot, 'server.js'), 'utf8');
const whatsapp = fs.readFileSync(path.join(__dirname, 'bot', 'whatsapp.js'), 'utf8');

assert.match(server, /await connectDB\(\)/, 'Server must wait for MongoDB before starting workers.');
assert.match(server, /connectToWhatsApp\(\)/, 'Server must start WhatsApp automatically.');
assert.match(legacyEntry, /require\(['"]\.\/src\/server['"]\)/, 'Legacy entry point must delegate to src/server.js.');
assert.match(whatsapp, /scheduleReconnect/, 'WhatsApp daemon must have automatic reconnect scheduling.');
assert.match(whatsapp, /\.ev\.on\(['"]messages\.upsert['"]/, 'WhatsApp daemon must listen for incoming messages.');
assert.match(whatsapp, /shutdownWhatsApp/, 'WhatsApp daemon must expose graceful shutdown.');

console.log('✅ 24/7 daemon architecture checks passed.');
