// Chạy một lần để lấy refresh_token Zalo OA:
//   ZALO_APP_SECRET=<secret> node get-zalo-token.js
// Sau khi có token, thêm vào .env trên VPS rồi xóa file này.
const http = require('http');
const url  = require('url');

const APP_ID     = '730631374647754105';
const APP_SECRET = process.env.ZALO_APP_SECRET || '';
const PORT       = 3456;
const REDIRECT   = `http://localhost:${PORT}`;

if (!APP_SECRET) {
  console.error('❌ Thiếu ZALO_APP_SECRET. Chạy lại:\n  ZALO_APP_SECRET=xxx node get-zalo-token.js');
  process.exit(1);
}

const authUrl =
  `https://oauth.zaloapp.com/v4/oa/permission` +
  `?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}`;

const server = http.createServer(async (req, res) => {
  const { code, error } = url.parse(req.url, true).query;

  if (error || !code) {
    res.end(`<h2>❌ Lỗi: ${error || 'không có code'}</h2>`);
    server.close();
    return;
  }

  res.end('<h2>✅ Đã lấy code! Kiểm tra terminal rồi đóng tab này.</h2>');
  server.close();

  try {
    const tokenRes = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': APP_SECRET,
      },
      body: new URLSearchParams({
        code,
        app_id: APP_ID,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT,
      }),
    });
    const data = await tokenRes.json();

    if (data.access_token) {
      console.log('\n✅ THÀNH CÔNG! Thêm vào .env trên VPS:\n');
      console.log(`ZALO_APP_ID=${APP_ID}`);
      console.log(`ZALO_APP_SECRET=${APP_SECRET}`);
      console.log(`ZALO_OA_TOKEN=${data.access_token}`);
      console.log(`ZALO_OA_REFRESH_TOKEN=${data.refresh_token}`);
      console.log('\n(access_token hết hạn sau ~1h, server sẽ tự gia hạn qua refresh_token)');
    } else {
      console.error('\n❌ Zalo trả lỗi:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('\n❌ Lỗi fetch:', e.message);
  }
});

server.listen(PORT, () => {
  console.log('\n=== LẤY TOKEN ZALO OA (chạy 1 lần) ===\n');
  console.log('Bước 1: Mở URL sau trong trình duyệt:\n');
  console.log(authUrl);
  console.log('\nBước 2: Đăng nhập tài khoản Zalo là Admin của OA Khôi Minh Media');
  console.log('Bước 3: Đợi redirect về localhost — terminal sẽ in ra 4 dòng env\n');
});
