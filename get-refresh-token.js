/**
 * Chạy script này 1 lần để lấy refresh token:
 *   node get-refresh-token.js
 *
 * Sau đó lưu GOOGLE_REFRESH_TOKEN vào Render env vars.
 */
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Chạy lại với env vars:\n');
  console.error('GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node get-refresh-token.js\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n=== Lấy Google Refresh Token ===\n');
console.log('1. Mở link này trong trình duyệt:\n');
console.log('   ' + url + '\n');
console.log('2. Đăng nhập tài khoản theson119@gmail.com');
console.log('3. Cho phép quyền truy cập');
console.log('4. Copy mã hiện ra và dán vào đây:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Nhập mã: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log('\n✅ Thành công! Lưu các giá trị sau vào Render env vars:\n');
    console.log(`GOOGLE_CLIENT_ID     = ${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET = ${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`);
    console.log('\n');
  } catch (e) {
    console.error('❌ Lỗi:', e.message);
  }
});
