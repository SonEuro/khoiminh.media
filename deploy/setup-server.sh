#!/bin/bash
# =============================================================
# Setup script - chạy 1 lần trên server sau khi SSH vào
# Usage: bash setup-server.sh
# =============================================================
set -e

APP_DIR="/home/ehntfovk/domains/kho.khoiminhmedia.vn/app"
PUBLIC_DIR="/home/ehntfovk/domains/kho.khoiminhmedia.vn/public_html"

echo "====== [1/5] Cài NVM + Node.js 20 ======"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
echo "Node: $(node -v), NPM: $(npm -v)"

echo "====== [2/5] Cài PM2 ======"
npm install -g pm2

echo "====== [3/5] Tạo thư mục app ======"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
mkdir -p "$PUBLIC_DIR"

echo "====== [4/5] Thêm NVM vào .bashrc ======"
if ! grep -q "NVM_DIR" ~/.bashrc; then
  cat >> ~/.bashrc << 'EOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
EOF
fi

echo "====== [5/5] Cài PM2 startup ======"
pm2 startup | tail -1

echo ""
echo "✅ Server đã sẵn sàng!"
echo "   App dir:    $APP_DIR"
echo "   Public dir: $PUBLIC_DIR"
echo ""
echo "Bước tiếp theo: chạy deploy.sh từ máy local"
