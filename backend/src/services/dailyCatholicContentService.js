/**
 * Daily Catholic Content Service (Canonical Alias)
 * Re-exports canonical content getters and formatters from canonicalContentService.js
 */

const canonicalContentService = require('./canonicalContentService');

module.exports = {
  ...canonicalContentService
};
