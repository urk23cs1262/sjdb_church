/**
 * PM2 Production Process Configuration — SJDB Connect 24/7 Platform
 * 
 * Ensures continuous, zero-downtime 24/7 background operation:
 * - Auto-restart on unexpected failure
 * - Memory-based automatic rolling restart
 * - Exponential backoff restart delay
 * - Standardized logging
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'sjdb-church-backend',
      script: './src/server.js',
      instances: 1, // Baileys session management operates in single-instance socket mode
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
