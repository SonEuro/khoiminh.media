module.exports = {
  apps: [{
    name: 'kho-khoiminh',
    script: './server/index.js',
    cwd: '/var/www/kho-khoiminh',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      TZ: 'Asia/Ho_Chi_Minh'
    },
    error_file: './logs/err.log',
    out_file:   './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
