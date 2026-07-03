#!/bin/bash
# =============================================================
# Setup VPS lần đầu – chạy 1 lần với quyền root
# Ubuntu 24.04 LTS | Node.js 20 | PM2 | Nginx | SSL
#
# Usage:
#   ssh root@103.15.51.119
#   bash <(curl -s https://raw.githubusercontent.com/GITHUB_USER/REPO/main/deploy/setup-vps.sh)
#
# Hoặc upload file rồi chạy:
#   scp deploy/setup-vps.sh root@103.15.51.119:~/
#   ssh root@103.15.51.119 "bash setup-vps.sh"
# =============================================================
set -e

# ── Cấu hình ──────────────────────────────────────────────────
APP_DIR="/var/www/kho-khoiminh"
GITHUB_REPO="https://github.com/SonEuro/khoiminh.media.git"
DOMAIN="khoiminhmedia.com"                                # ← Subdomain trỏ về 103.15.51.119
# ──────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup VPS – Kho Khôi Minh                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── [1/7] Cập nhật hệ thống ───────────────────────────────────
echo "▶ [1/7] Cập nhật hệ thống..."
apt update && apt upgrade -y
apt install -y curl git build-essential

# ── [2/7] Cài Node.js 20 ──────────────────────────────────────
echo ""
echo "▶ [2/7] Cài Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "   Node: $(node -v) | NPM: $(npm -v)"

# ── [3/7] Cài PM2 + Nginx + Certbot ──────────────────────────
echo ""
echo "▶ [3/7] Cài PM2, Nginx, Certbot..."
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
echo "   ✅ PM2, Nginx, Certbot đã cài"

# ── [4/7] Clone repo & build ──────────────────────────────────
echo ""
echo "▶ [4/7] Clone repo và build..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"

if [ -d "$APP_DIR/.git" ]; then
  echo "   Repo đã tồn tại, chạy git pull..."
  cd "$APP_DIR" && git pull origin main
else
  git clone "$GITHUB_REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

npm install
npm run build
echo "   ✅ Build xong"

# ── [5/7] Tạo file .env ───────────────────────────────────────
echo ""
echo "▶ [5/7] Tạo file .env..."
if [ ! -f "$APP_DIR/server/.env" ]; then
  # Sinh JWT_SECRET ngẫu nhiên 64 ký tự
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$APP_DIR/server/.env" << EOF
NODE_ENV=production
PORT=3001
JWT_SECRET=$JWT_SECRET

# ── Google Drive Backup ──────────────────────────
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REFRESH_TOKEN=
# GOOGLE_DRIVE_FOLDER_ID=

# ── Zalo OA (nếu dùng) ──────────────────────────
# ZALO_APP_ID=
# ZALO_APP_SECRET=
# ZALO_OA_TOKEN=
# ZALO_OA_REFRESH_TOKEN=
EOF
  echo "   ✅ Đã tạo server/.env với JWT_SECRET ngẫu nhiên"
  echo "   ⚠️  Điền thêm Google Drive / Zalo keys nếu cần"
else
  echo "   server/.env đã tồn tại, bỏ qua"
fi

# ── [6/7] Cài Nginx config & khởi động PM2 ────────────────────
echo ""
echo "▶ [6/7] Cài Nginx reverse proxy..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/kho-khoiminh

# Thay DOMAIN placeholder trong nginx.conf
sed -i "s/YOUR_DOMAIN_HERE/$DOMAIN/g" /etc/nginx/sites-available/kho-khoiminh

# Bật site
ln -sf /etc/nginx/sites-available/kho-khoiminh /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "   ✅ Nginx đã cấu hình"

echo ""
echo "▶ [6b/7] Khởi động PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.cjs --env production
pm2 save

# Cấu hình PM2 tự khởi động khi reboot
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
pm2 save
echo "   ✅ PM2 đang chạy"

# ── [7/7] Cài SSL (cần domain trỏ về IP này trước) ────────────
echo ""
echo "▶ [7/7] Cài SSL với Let's Encrypt..."
if [ "$DOMAIN" != "103.15.51.119" ]; then
  certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos \
    --email admin@khoiminhmedia.com \
    --redirect
  echo "   ✅ SSL đã cài: https://$DOMAIN"
else
  echo "   ⚠️  Đang dùng IP thay vì domain – bỏ qua SSL"
  echo "   → Trỏ domain về 103.15.51.119 rồi chạy:"
  echo "      certbot --nginx -d your-domain.com"
fi

# ── Kết quả ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅ SETUP HOÀN TẤT!                                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "   App dir:  $APP_DIR"
echo "   PM2:      pm2 list"
echo "   Nginx:    systemctl status nginx"
echo "   Logs:     pm2 logs kho-khoiminh"
echo ""
pm2 list
