#!/bin/bash
# =============================================================
# Deploy script - chạy từ máy local (Mac)
# Usage: bash deploy/deploy.sh user@khoiminhmedia.vn
# =============================================================
set -e

SSH_TARGET="${1:-ehntfovk@free02.123host.vn}"
REMOTE_DIR="domains/kho.khoiminhmedia.vn/app"
PUBLIC_DIR="domains/kho.khoiminhmedia.vn/public_html"
LOCAL_BASE="$(cd "$(dirname "$0")/.." && pwd)"

echo "======================================================"
echo "  Deploy: Kho Khôi Minh → $SSH_TARGET"
echo "======================================================"

echo ""
echo "▶ [1/5] Build React frontend..."
cd "$LOCAL_BASE/client"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
echo "   ✅ Build xong: client/dist/"

echo ""
echo "▶ [2/5] Upload frontend (static files)..."
rsync -avz --delete \
  "$LOCAL_BASE/client/dist/" \
  "$SSH_TARGET:~/$PUBLIC_DIR/"
echo "   ✅ Frontend uploaded"

echo ""
echo "▶ [3/5] Upload backend..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='kho.db' \
  --exclude='logs' \
  "$LOCAL_BASE/server/" \
  "$SSH_TARGET:~/$REMOTE_DIR/server/"

rsync -avz \
  "$LOCAL_BASE/ecosystem.config.cjs" \
  "$SSH_TARGET:~/$REMOTE_DIR/"
echo "   ✅ Backend uploaded"

echo ""
echo "▶ [4/5] Cài dependencies & khởi động..."
ssh "$SSH_TARGET" bash << 'REMOTE'
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  cd ~/domains/kho.khoiminhmedia.vn/app

  # Cài npm packages
  cd server && npm install --production && cd ..

  # Khởi động / reload PM2
  if pm2 list | grep -q kho-khoiminh; then
    pm2 reload ecosystem.config.cjs
  else
    pm2 start ecosystem.config.cjs
  fi

  pm2 save
  echo "   PM2 status:"
  pm2 list
REMOTE

echo ""
echo "▶ [5/5] Upload .htaccess (reverse proxy)..."
ssh "$SSH_TARGET" cat > "~/$PUBLIC_DIR/.htaccess" << 'HTACCESS'
Options -Indexes
RewriteEngine On

# API: proxy sang Node.js port 3001
RewriteCond %{REQUEST_URI} ^/api [NC]
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]

# SPA fallback: trả về index.html cho mọi route
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
HTACCESS

echo ""
echo "======================================================"
echo "✅ DEPLOY XONG!"
echo "   URL: https://kho.khoiminhmedia.vn"
echo ""
echo "Lưu ý:"
echo "  1. Vào DirectAdmin → Subdomains → tạo kho.khoiminhmedia.vn"
echo "  2. Vào SSL Certificates → Let's Encrypt → cài SSL"
echo "  3. Bật mod_proxy trong DirectAdmin nếu cần"
echo "======================================================"
