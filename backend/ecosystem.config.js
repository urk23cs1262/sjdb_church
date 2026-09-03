/**
 * PM2 configuration for a self-hosted/VM deployment.
 * Render/other managed platforms should use `npm start` instead.
 */
module.exports = {
  apps: [{
    name: 'sjdb-church-backend',
    cwd: __dirname,
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '750M',
    exp_backoff_restart_delay: 100,
    kill_timeout: 10000,
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true
  }]
};
