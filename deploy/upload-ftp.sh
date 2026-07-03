#!/bin/bash
# =============================================================
# Upload lên 123host.vn qua FTP
# Usage: bash deploy/upload-ftp.sh
# =============================================================
set -e

FTP_HOST="free02.123host.vn"
FTP_USER="ehntfovk"
FTP_PASS="jKSmhOugA2"
REMOTE_DIR="domains/khoiminhmedia.vn/public_html/kho"

LOCAL_BASE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$LOCAL_BASE/client/dist"
PHP_DIR="$LOCAL_BASE/php-backend"

echo "================================================"
echo "  Upload Kho Khôi Minh → khoiminhmedia.vn/kho"
echo "================================================"

# Build React trước
echo "▶ [1/3] Build React frontend..."
cd "$LOCAL_BASE/client"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run build
echo "   ✅ Build xong"

echo ""
echo "▶ [2/3] Upload qua FTP..."

# Dùng curl để upload từng file (hoặc dùng lftp nếu có)
if command -v lftp &>/dev/null; then
    echo "   Dùng lftp..."
    lftp -u "$FTP_USER,$FTP_PASS" "ftp://$FTP_HOST" << LFTP_SCRIPT
        set ssl:verify-certificate no
        set ftp:passive-mode yes
        mirror --reverse --delete --verbose \
            "$BUILD_DIR/" \
            "/$REMOTE_DIR/"
        mirror --reverse --delete --verbose \
            "$PHP_DIR/api/" \
            "/$REMOTE_DIR/api/"
        put "$PHP_DIR/.htaccess" -o "/$REMOTE_DIR/.htaccess"
        bye
LFTP_SCRIPT
else
    echo "   lftp không có sẵn. Dùng curl để upload từng file..."

    # Upload .htaccess gốc
    curl -s -T "$PHP_DIR/.htaccess" \
        "ftp://$FTP_HOST/$REMOTE_DIR/.htaccess" \
        --user "$FTP_USER:$FTP_PASS" \
        --ftp-create-dirs

    # Upload PHP files
    for f in "$PHP_DIR/api/"*; do
        fname=$(basename "$f")
        echo "   Upload api/$fname..."
        curl -s -T "$f" \
            "ftp://$FTP_HOST/$REMOTE_DIR/api/$fname" \
            --user "$FTP_USER:$FTP_PASS" \
            --ftp-create-dirs
    done

    # Upload React build
    find "$BUILD_DIR" -type f | while read f; do
        rel="${f#$BUILD_DIR/}"
        echo "   Upload $rel..."
        curl -s -T "$f" \
            "ftp://$FTP_HOST/$REMOTE_DIR/$rel" \
            --user "$FTP_USER:$FTP_PASS" \
            --ftp-create-dirs
    done
fi

echo ""
echo "▶ [3/3] Kiểm tra..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$FTP_HOST")
echo "   HTTP status: $STATUS"

echo ""
echo "================================================"
echo "✅ UPLOAD XONG!"
echo ""
echo "   URL: https://khoiminhmedia.vn/kho"
echo ""
echo "⚠️  Lưu ý: Tạo thư mục kho_data ngoài public_html"
echo "   để database không bị truy cập từ web."
echo "================================================"
