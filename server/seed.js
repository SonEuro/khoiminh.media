const db = require('./database');

const categories = [
  { name: 'Thiết Bị Kỹ Thuật',   code: 'TECH',   icon: '🎥' },
  { name: 'Thiết Bị Âm Thanh',   code: 'AUDIO',  icon: '🔊' },
  { name: 'Thiết Bị Ánh Sáng',   code: 'LIGHT',  icon: '💡' },
  { name: 'Màn Hình LED',         code: 'LED',    icon: '📺' },
  { name: 'Matrix LED',           code: 'MATRIX', icon: '✨' },
  { name: 'Hạng Mục Sân Khấu',   code: 'STAGE',  icon: '🎭' },
];

const equipment = [
  // ── THIẾT BỊ KỸ THUẬT ──────────────────────────────────────────────
  // Switcher (codes kept from original seed)
  { code: 'TECH-001', name: 'Switcher 20 Line SDI',          cat: 'TECH', unit: 'Bộ',   price: 8000000, qty: 2 },
  { code: 'TECH-002', name: 'Switcher 16 Line SDI',          cat: 'TECH', unit: 'Bộ',   price: 6000000, qty: 2 },
  { code: 'TECH-003', name: 'Switcher 12 Line SDI',          cat: 'TECH', unit: 'Bộ',   price: 4200000, qty: 3 },
  { code: 'TECH-004', name: 'Switcher 8 Line SDI',           cat: 'TECH', unit: 'Bộ',   price: 3700000, qty: 3 },
  { code: 'TECH-005', name: 'Switcher 4 Line SDI',           cat: 'TECH', unit: 'Bộ',   price: 2100000, qty: 4 },
  // Intercom & Accessories
  { code: 'TECH-006', name: 'Bộ Chủ Intercom Naya 360',     cat: 'TECH', unit: 'Bộ',   price: 2000000, qty: 1 },
  { code: 'TECH-007', name: 'Bộ Chủ Intercom Naya 180',     cat: 'TECH', unit: 'Bộ',   price: 1000000, qty: 1 },
  { code: 'TECH-008', name: 'Intercom Wireless',             cat: 'TECH', unit: 'Cái',  price:  200000, qty: 4 },
  { code: 'TECH-009', name: 'Tally Wireless',                cat: 'TECH', unit: 'Cái',  price:  100000, qty: 4 },
  { code: 'TECH-010', name: 'Đầu Ghi Blackmagic + Ổ Cứng',  cat: 'TECH', unit: 'Bộ',   price:  500000, qty: 2 },
  { code: 'TECH-011', name: 'Bộ Teranex Mini Audio 12G',     cat: 'TECH', unit: 'Bộ',   price:  500000, qty: 1 },
  { code: 'TECH-012', name: 'Mixer Audio 4-8 Line',          cat: 'TECH', unit: 'Cái',  price:  500000, qty: 2 },
  { code: 'TECH-013', name: 'Audio Monitor',                 cat: 'TECH', unit: 'Cái',  price:  500000, qty: 2 },
  // Camera
  { code: 'TECH-014', name: 'Camera Sony X400',              cat: 'TECH', unit: 'Bộ',   price: 1500000, qty: 1 },
  { code: 'TECH-015', name: 'Camera Sony FX3',               cat: 'TECH', unit: 'Bộ',   price:  700000, qty: 1 },
  { code: 'TECH-016', name: 'Camera Sony FX6',               cat: 'TECH', unit: 'Bộ',   price: 1000000, qty: 1 },
  { code: 'TECH-017', name: 'Camera Sony PMW-350',           cat: 'TECH', unit: 'Bộ',   price:  800000, qty: 1 },
  { code: 'TECH-018', name: 'Handycam Sony 4K',              cat: 'TECH', unit: 'Cái',  price:  500000, qty: 1 },
  { code: 'TECH-019', name: 'Handycam Sony HD',              cat: 'TECH', unit: 'Cái',  price:  200000, qty: 1 },
  // Ống Kính
  { code: 'TECH-020', name: 'Lens Wide 4K',                  cat: 'TECH', unit: 'Cái',  price: 2500000, qty: 1 },
  { code: 'TECH-021', name: 'Lens Canon 40x',                cat: 'TECH', unit: 'Cái',  price: 3000000, qty: 1 },
  { code: 'TECH-022', name: 'Lens Fujinon 42x',              cat: 'TECH', unit: 'Cái',  price: 3000000, qty: 1 },
  { code: 'TECH-023', name: 'Lens Tele 138mm-X2',            cat: 'TECH', unit: 'Cái',  price:  550000, qty: 1 },
  { code: 'TECH-024', name: 'Lens Tele Zoom 160mm-172mm',    cat: 'TECH', unit: 'Cái',  price:  550000, qty: 1 },
  { code: 'TECH-025', name: 'Lens Norman',                   cat: 'TECH', unit: 'Cái',  price:  400000, qty: 1 },
  { code: 'TECH-026', name: 'Lens Canon Cine 24-50-85',      cat: 'TECH', unit: 'Bộ',   price:  950000, qty: 1 },
  { code: 'TECH-027', name: 'Lens Canon EF',                 cat: 'TECH', unit: 'Cái',  price:  200000, qty: 1 },
  { code: 'TECH-028', name: 'Lens 16/35 PZ',                 cat: 'TECH', unit: 'Cái',  price:  300000, qty: 1 },
  { code: 'TECH-029', name: 'Lens 28/135 PZ',                cat: 'TECH', unit: 'Cái',  price:  400000, qty: 1 },
  { code: 'TECH-030', name: 'Lens 24/70 GM',                 cat: 'TECH', unit: 'Cái',  price:  300000, qty: 1 },
  { code: 'TECH-031', name: 'Lens 16/35 GM',                 cat: 'TECH', unit: 'Cái',  price:  300000, qty: 1 },
  { code: 'TECH-032', name: 'Lens 70/200 GM',                cat: 'TECH', unit: 'Cái',  price:  300000, qty: 1 },
  { code: 'TECH-033', name: 'Lens 70/200 GM2',               cat: 'TECH', unit: 'Cái',  price:  300000, qty: 1 },
  { code: 'TECH-034', name: 'Lens 200/600',                  cat: 'TECH', unit: 'Cái',  price:  400000, qty: 1 },
  { code: 'TECH-035', name: 'Lens 400/800',                  cat: 'TECH', unit: 'Cái',  price:  500000, qty: 1 },
  { code: 'TECH-036', name: 'Lens Wide Canon PL/EF 17-120',  cat: 'TECH', unit: 'Cái',  price: 2000000, qty: 1 },
  // Monitor & TV
  { code: 'TECH-037', name: 'Monitor 27"',                   cat: 'TECH', unit: 'Cái',  price:  700000, qty: 1 },
  { code: 'TECH-038', name: 'Monitor 14-17"',                cat: 'TECH', unit: 'Cái',  price:  500000, qty: 1 },
  { code: 'TECH-039', name: 'Monitor 5-9"',                  cat: 'TECH', unit: 'Cái',  price:  200000, qty: 1 },
  { code: 'TECH-040', name: 'TV Sony 65"',                   cat: 'TECH', unit: 'Cái',  price: 1100000, qty: 1 },
  { code: 'TECH-041', name: 'TV Sony 42"',                   cat: 'TECH', unit: 'Cái',  price:  500000, qty: 1 },
  { code: 'TECH-042', name: 'TV Asanzo 40"',                 cat: 'TECH', unit: 'Cái',  price:  400000, qty: 1 },
  // Thiết Bị Đặc Biệt
  { code: 'TECH-043', name: 'Đầu Boom Varizoom + Zoom/Focus/Iris', cat: 'TECH', unit: 'Bộ', price: 1600000, qty: 1 },
  { code: 'TECH-044', name: 'Topshot Remote',                cat: 'TECH', unit: 'Bộ',   price: 2500000, qty: 1 },
  { code: 'TECH-045', name: 'Boom Remote Varizoom Full Set', cat: 'TECH', unit: 'Bộ',   price: 4200000, qty: 1 },
  { code: 'TECH-046', name: 'Dolly Dưới 20m',               cat: 'TECH', unit: 'Bộ',   price:  500000, qty: 1 },
  { code: 'TECH-047', name: 'Dolly Trên 20m',               cat: 'TECH', unit: 'Bộ',   price: 1100000, qty: 1 },
  { code: 'TECH-048', name: 'Slide 3m',                      cat: 'TECH', unit: 'Bộ',   price:  400000, qty: 1 },
  { code: 'TECH-049', name: 'Ronin RS4 PRO',                 cat: 'TECH', unit: 'Cái',  price:  400000, qty: 1 },
  { code: 'TECH-050', name: 'Steadicam G45',                 cat: 'TECH', unit: 'Bộ',   price: 2100000, qty: 1 },
  // Chân Máy
  { code: 'TECH-051', name: 'Chân Máy E-Mage',              cat: 'TECH', unit: 'Cái',  price:  200000, qty: 1 },
  { code: 'TECH-052', name: 'Chân Máy Vinten',               cat: 'TECH', unit: 'Cái',  price:  500000, qty: 1 },
  { code: 'TECH-053', name: 'Chân Máy SECCED',               cat: 'TECH', unit: 'Cái',  price:  200000, qty: 1 },
  // Phụ Kiện
  { code: 'TECH-054', name: 'Camlink HD DJI Transmission',   cat: 'TECH', unit: 'Bộ',   price: 1000000, qty: 1 },
  { code: 'TECH-055', name: 'Bộ Chia SDI',                   cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-056', name: 'Bộ Chia HDMI',                  cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-057', name: 'Bộ Chuyển SDI To Optical',      cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-058', name: 'Bộ Chuyển SDI To HDMI',         cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-059', name: 'Bộ Chuyển HDMI To SDI',         cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-060', name: 'Mount Chuyển EF To B4',          cat: 'TECH', unit: 'Cái',  price: 1000000, qty: 1 },
  { code: 'TECH-061', name: 'Pin V-Mount',                   cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-062', name: 'Thẻ SXS 64G',                  cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-063', name: 'Thẻ SXS 32G',                  cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-064', name: 'Ổ Cứng SSD Samsung 500G',       cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-065', name: 'Ổ Cứng SSD Samsung 250G',       cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-066', name: 'Đầu Chép Thẻ Các Loại',         cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-067', name: 'Tay Zoom Canon/Fujinon',        cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-068', name: 'Tay Focus Canon/Fujinon',       cat: 'TECH', unit: 'Cái',  price:  100000, qty: 1 },
  { code: 'TECH-069', name: 'Dây Cáp SDI 50m',               cat: 'TECH', unit: 'Sợi',  price:  100000, qty: 1 },
  { code: 'TECH-070', name: 'Dây Cáp SDI 80m',               cat: 'TECH', unit: 'Sợi',  price:  100000, qty: 1 },
  { code: 'TECH-071', name: 'Dây Cáp Quang 300m',            cat: 'TECH', unit: 'Sợi',  price:  300000, qty: 1 },

  // ── THIẾT BỊ ÂM THANH ──────────────────────────────────────────────
  { code: 'AUDIO-001', name: 'Mixer Live Midas M32',                    cat: 'AUDIO', unit: 'Cái', price: 1500000, qty: 2 },
  { code: 'AUDIO-002', name: 'Mixer Live Allen&Heath SQ7',              cat: 'AUDIO', unit: 'Cái', price: 1500000, qty: 1 },
  { code: 'AUDIO-003', name: 'Mixer Live Yamaha TF1',                   cat: 'AUDIO', unit: 'Cái', price:  950000, qty: 2 },
  { code: 'AUDIO-004', name: 'Speaker Sub RCF 9006 AS',                 cat: 'AUDIO', unit: 'Cái', price:  760000, qty: 8 },
  { code: 'AUDIO-005', name: 'Speaker Full Array RCF HDL 30A',          cat: 'AUDIO', unit: 'Cái', price:  570000, qty: 12 },
  { code: 'AUDIO-006', name: 'Speaker Monitor RCF ST12 SMA',            cat: 'AUDIO', unit: 'Cái', price:  380000, qty: 6 },
  { code: 'AUDIO-007', name: 'Main Công Suất 2 Kênh',                   cat: 'AUDIO', unit: 'Cái', price:  300000, qty: 4 },
  { code: 'AUDIO-008', name: 'Main Công Suất 4 Kênh',                   cat: 'AUDIO', unit: 'Cái', price:  600000, qty: 3 },
  { code: 'AUDIO-009', name: 'Microphone Cầm Tay Shure ULXD',           cat: 'AUDIO', unit: 'Cái', price:  800000, qty: 4 },
  { code: 'AUDIO-010', name: 'Microphone Headset Shure ULXD1-G50',      cat: 'AUDIO', unit: 'Cái', price:  800000, qty: 4 },
  { code: 'AUDIO-011', name: 'Microphone Headset Sennheiser G3',        cat: 'AUDIO', unit: 'Cái', price:  800000, qty: 4 },
  { code: 'AUDIO-012', name: 'Inear Shure Axient AD',                   cat: 'AUDIO', unit: 'Cái', price:  800000, qty: 2 },
  { code: 'AUDIO-013', name: 'Inear Sennheiser IEM 300',                cat: 'AUDIO', unit: 'Cái', price:  800000, qty: 2 },
  { code: 'AUDIO-014', name: 'Microphone Shure MX418 Phát Biểu',        cat: 'AUDIO', unit: 'Cái', price:  500000, qty: 4 },
  { code: 'AUDIO-015', name: 'Microphone Shure DPA',                    cat: 'AUDIO', unit: 'Bộ',  price: 3000000, qty: 1 },
  { code: 'AUDIO-016', name: 'Bộ Chia Ăngten ASA',                      cat: 'AUDIO', unit: 'Bộ',  price:  500000, qty: 2 },
  { code: 'AUDIO-017', name: 'Lá Sóng Định Hướng Ăngten ADP UHF',       cat: 'AUDIO', unit: 'Bộ',  price:  500000, qty: 2 },
  { code: 'AUDIO-018', name: 'Cáp Line 24in-8out 50m',                  cat: 'AUDIO', unit: 'Bộ',  price: 3000000, qty: 2 },
  { code: 'AUDIO-019', name: 'Stand Chân Loa Monitor',                  cat: 'AUDIO', unit: 'Cái', price:       0, qty: 4 },
  { code: 'AUDIO-020', name: 'Balang Treo Loa',                         cat: 'AUDIO', unit: 'Cái', price:       0, qty: 2 },
  { code: 'AUDIO-021', name: 'Giá Treo Loa',                            cat: 'AUDIO', unit: 'Cái', price:       0, qty: 2 },

  // ── THIẾT BỊ ÁNH SÁNG ──────────────────────────────────────────────
  { code: 'LIGHT-001', name: 'Controller Tiger Touch',              cat: 'LIGHT', unit: 'Cái',  price:  900000, qty: 2 },
  { code: 'LIGHT-002', name: 'Controller MA2',                      cat: 'LIGHT', unit: 'Cái',  price: 1500000, qty: 1 },
  { code: 'LIGHT-003', name: 'Đèn Movinghead Spot 1000W',           cat: 'LIGHT', unit: 'Cái',  price: 1000000, qty: 10 },
  { code: 'LIGHT-004', name: 'Đèn Movinghead Spot 400W',            cat: 'LIGHT', unit: 'Cái',  price:  700000, qty: 15 },
  { code: 'LIGHT-005', name: 'Đèn Movinghead Beam 260W',            cat: 'LIGHT', unit: 'Cái',  price:  200000, qty: 20 },
  { code: 'LIGHT-006', name: 'Đèn Par LED 1810',                    cat: 'LIGHT', unit: 'Cái',  price:   80000, qty: 40 },
  { code: 'LIGHT-007', name: 'Đèn Big Eye 1915',                    cat: 'LIGHT', unit: 'Cái',  price:  200000, qty: 8 },
  { code: 'LIGHT-008', name: 'Đèn Katana 1240',                     cat: 'LIGHT', unit: 'Cái',  price:  200000, qty: 6 },
  { code: 'LIGHT-009', name: 'Đèn Profile LED 300',                 cat: 'LIGHT', unit: 'Mét',  price:  150000, qty: 20 },
  { code: 'LIGHT-010', name: 'Đèn Cob 200',                         cat: 'LIGHT', unit: 'Cái',  price:   80000, qty: 10 },
  { code: 'LIGHT-011', name: 'Đèn Daylight 3618',                   cat: 'LIGHT', unit: 'Cái',  price:  200000, qty: 6 },
  { code: 'LIGHT-012', name: 'Đèn Strobe LED 250',                  cat: 'LIGHT', unit: 'Cái',  price:  200000, qty: 6 },
  { code: 'LIGHT-013', name: 'Đèn Blinder LED 200',                 cat: 'LIGHT', unit: 'Cái',  price:  100000, qty: 8 },
  { code: 'LIGHT-014', name: 'Máy Khói Z3000W',                     cat: 'LIGHT', unit: 'Cái',  price:  400000, qty: 2 },
  { code: 'LIGHT-015', name: 'Máy Khói HZ650W',                     cat: 'LIGHT', unit: 'Cái',  price:  400000, qty: 2 },
  { code: 'LIGHT-016', name: 'Quạt Khói',                           cat: 'LIGHT', unit: 'Cái',  price:  100000, qty: 2 },
  { code: 'LIGHT-017', name: 'Khung Truss 400x400 (Nhôm)',          cat: 'LIGHT', unit: 'Mét',  price:  150000, qty: 20 },
  { code: 'LIGHT-018', name: 'Khung Truss 520x760 (Nhôm)',          cat: 'LIGHT', unit: 'Mét',  price:  250000, qty: 20 },
  { code: 'LIGHT-019', name: 'Khung Truss 800x1000 (Nhôm)',         cat: 'LIGHT', unit: 'Mét',  price: 1000000, qty: 10 },
  { code: 'LIGHT-020', name: 'Balang 2T Treo Truss',                cat: 'LIGHT', unit: 'Cái',  price:       0, qty: 4 },

  // ── MÀN HÌNH LED ───────────────────────────────────────────────────
  { code: 'LED-001', name: 'Led P3.91 Indoor (Cabin 500x500)',  cat: 'LED', unit: 'Mét',  price:  600000, qty: 50 },
  { code: 'LED-002', name: 'Led P3.91 Outdoor (Cabin 500x500)', cat: 'LED', unit: 'Mét',  price:  900000, qty: 30 },
  { code: 'LED-003', name: 'Magnimage MH570',                   cat: 'LED', unit: 'Bộ',   price: 1000000, qty: 2 },
  { code: 'LED-004', name: 'Magnimage EC40',                    cat: 'LED', unit: 'Bộ',   price: 5000000, qty: 1 },
  { code: 'LED-005', name: 'Cardsen Nova MCTRL600',             cat: 'LED', unit: 'Bộ',   price: 1000000, qty: 3 },

  // ── MATRIX LED ─────────────────────────────────────────────────────
  { code: 'MATRIX-001', name: 'Led Matrix Dây ICSJ-10060 RGB-DMX',                  cat: 'MATRIX', unit: 'Mét', price: 120000, qty: 100 },
  { code: 'MATRIX-002', name: 'Artnet 16 Port',                                     cat: 'MATRIX', unit: 'Cái', price:      0, qty: 4 },
  { code: 'MATRIX-003', name: 'Máy Tính Lập Trình MSI Stealth 14 AI Studio',        cat: 'MATRIX', unit: 'Cái', price:      0, qty: 1 },
  { code: 'MATRIX-004', name: 'Nguồn 12V (Matrix)',                                 cat: 'MATRIX', unit: 'Cái', price:      0, qty: 1 },

  // ── HẠNG MỤC SÂN KHẤU ─────────────────────────────────────────────
  // Sàn (codes kept from original seed)
  { code: 'STAGE-001', name: 'Kính Cường Lực 12mm - Cho Thuê',                     cat: 'STAGE', unit: 'M2',  price:  150000, qty: 200 },
  { code: 'STAGE-002', name: 'Ván MDF - Cho Thuê',                                 cat: 'STAGE', unit: 'M2',  price:   90000, qty: 300 },
  { code: 'STAGE-003', name: 'Sàn Nhôm',                                           cat: 'STAGE', unit: 'M2',  price:        0, qty: 150 },
  // New stage items
  { code: 'STAGE-004', name: 'Kính Cường Lực 12mm - NEW (Khổ 1m x 2m)',           cat: 'STAGE', unit: 'M2',  price:  750000, qty: 1 },
  { code: 'STAGE-005', name: 'Kính Cường Lực 12mm - NEW (Quá Khổ)',               cat: 'STAGE', unit: 'M2',  price:  980000, qty: 1 },
  { code: 'STAGE-006', name: 'Ván MDF - NEW',                                      cat: 'STAGE', unit: 'M2',  price:  210000, qty: 1 },
  { code: 'STAGE-007', name: 'Decal Màu Cơ Bản',                                  cat: 'STAGE', unit: 'M2',  price:   55000, qty: 1 },
  { code: 'STAGE-008', name: 'Decal In Artwork',                                   cat: 'STAGE', unit: 'M2',  price:  120000, qty: 1 },
  { code: 'STAGE-009', name: 'Decal In Artwork (Xuyên Đèn)',                       cat: 'STAGE', unit: 'M2',  price:  230000, qty: 1 },
  { code: 'STAGE-010', name: 'Decal In + Bế Artwork (Xuyên Đèn)',                 cat: 'STAGE', unit: 'M2',  price:  350000, qty: 1 },
  { code: 'STAGE-011', name: 'Mặt Dựng: Khung Sắt + Ván + Sơn',                  cat: 'STAGE', unit: 'M2',  price:  350000, qty: 1 },
  { code: 'STAGE-012', name: 'Mặt Dựng: Khung Sắt + Mica + LED 7 Màu',           cat: 'STAGE', unit: 'M2',  price:  530000, qty: 1 },
  { code: 'STAGE-013', name: 'Mặt Dựng: Khung Sắt Để Gắn LED',                   cat: 'STAGE', unit: 'M2',  price:  200000, qty: 1 },
  { code: 'STAGE-014', name: 'Khung Sắt 30x30 Thẳng - Làm Mới',                  cat: 'STAGE', unit: 'M2',  price:  220000, qty: 1 },
  { code: 'STAGE-015', name: 'Khung Sắt 30x30 Thẳng - Cho Thuê',                 cat: 'STAGE', unit: 'M2',  price:  100000, qty: 1 },
  { code: 'STAGE-016', name: 'Khung Sắt 30x30 Cong Quá Khổ - Làm Mới',           cat: 'STAGE', unit: 'M2',  price:  280000, qty: 1 },
  { code: 'STAGE-017', name: 'Khung Sắt 30x30 Cong Quá Khổ - Cho Thuê',          cat: 'STAGE', unit: 'M2',  price:  150000, qty: 1 },
  { code: 'STAGE-018', name: 'Background: Khung Sắt + Hiflex',                    cat: 'STAGE', unit: 'M2',  price:  210000, qty: 1 },
  { code: 'STAGE-019', name: 'Background: Khung Sắt + Formex + In PP (1 Mặt)',    cat: 'STAGE', unit: 'M2',  price:  430000, qty: 1 },
  { code: 'STAGE-020', name: 'Background: Khung Sắt + Formex + In PP (2 Mặt)',    cat: 'STAGE', unit: 'M2',  price:  780000, qty: 1 },
  { code: 'STAGE-021', name: 'Background: Khung Sắt + Ván Sơn Màu',               cat: 'STAGE', unit: 'M2',  price:  350000, qty: 1 },
  { code: 'STAGE-022', name: 'Hộp Đèn 10cm: Khung Sắt + Mica + Nguồn + LED',     cat: 'STAGE', unit: 'M',   price:  320000, qty: 1 },
  { code: 'STAGE-023', name: 'Hộp Đèn 20cm: Khung Sắt + Mica + Nguồn + LED',     cat: 'STAGE', unit: 'M',   price:  410000, qty: 1 },
  { code: 'STAGE-024', name: 'Hộp Đèn 30cm: Khung Sắt + Mica + Nguồn + LED',     cat: 'STAGE', unit: 'M',   price:  520000, qty: 1 },
  { code: 'STAGE-025', name: 'Layer Truss + Gia Cố',                               cat: 'STAGE', unit: 'M3',  price:   70000, qty: 1 },
];

function seed() {
  const insertCat = db.prepare(
    'INSERT OR IGNORE INTO categories (name, code, icon) VALUES (?, ?, ?)'
  );
  const insertEq = db.prepare(`
    INSERT OR IGNORE INTO equipment
      (code, name, category_id, unit, unit_price, qty_total, qty_available)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    for (const c of categories) insertCat.run(c.name, c.code, c.icon);

    const catMap = {};
    db.prepare('SELECT id, code FROM categories').all()
      .forEach(r => { catMap[r.code] = r.id; });

    for (const e of equipment) {
      insertEq.run(e.code, e.name, catMap[e.cat], e.unit, e.price, e.qty, e.qty);
    }
  });

  run();

  const total = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
  console.log(`Seed complete — ${total} equipment items in DB.`);
}

seed();
