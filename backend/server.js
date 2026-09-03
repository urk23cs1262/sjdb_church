/**
 * Compatibility entry point.
 * Always use src/server.js so every deployment command starts the same
 * API + background workers + WhatsApp daemon.
 */
require('./src/server');
