const db = require('./database');

const categories = [
  { name: 'Thiết Bị Kỹ Thuật', code: 'TECH', icon: '🎥' },
  { name: 'Thiết Bị Âm Thanh', code: 'AUDIO', icon: '🔊' },
  { name: 'Thiết Bị Ánh Sáng', code: 'LIGHT', icon: '💡' },
  { name: 'Màn Hình LED', code: 'LED', icon: '📺' },
  { name: 'Matrix LED', code: 'MATRIX', icon: '✨' },
  { name: 'Hạng Mục Sân Khấu', code: 'STAGE', icon: '🎭' },
];

const equipment = [
  // TECH
  { code: 'TECH-001', name: 'Switcher 20 Line SDI', cat: 'TECH', unit: 'Bộ', price: 8000000, qty: 2 },
  { code: 'TECH-002', name: 'Switcher 16 Line SDI', cat: 'TECH', unit: 'Bộ', price: 6000000, qty: 2 },
  { code: 'TECH-003', name: 'Switcher 12 Line SDI', cat: 'TECH', unit: 'Bộ', price: 4200000, qty: 3 },
  { code: 'TECH-004', name: 'Switcher 8 Line SDI', cat: 'TECH', unit: 'Bộ', price: 3700000, qty: 3 },
  { code: 'TECH-005', name: 'Switcher 4 Line SDI', cat: 'TECH', unit: 'Bộ', price: 2100000, qty: 4 },

  // AUDIO
  { code: 'AUDIO-001', name: 'Mixer Live Midas M32', cat: 'AUDIO', unit: 'Cái', price: 1500000, qty: 2 },
  { code: 'AUDIO-002', name: 'Mixer Live Allen&Heath SQ7', cat: 'AUDIO', unit: 'Cái', price: 1500000, qty: 1 },
  { code: 'AUDIO-003', name: 'Mixer Live Yamaha TF1', cat: 'AUDIO', unit: 'Cái', price: 950000, qty: 2 },
  { code: 'AUDIO-004', name: 'Speaker Sub RCF 9006 AS', cat: 'AUDIO', unit: 'Cái', price: 760000, qty: 8 },
  { code: 'AUDIO-005', name: 'Speaker Full Array RCF HDL 30A', cat: 'AUDIO', unit: 'Cái', price: 570000, qty: 12 },
  { code: 'AUDIO-006', name: 'Speaker Monitor RCF ST12 SMA', cat: 'AUDIO', unit: 'Cái', price: 380000, qty: 6 },
  { code: 'AUDIO-007', name: 'Main Công Suất 2 Kênh', cat: 'AUDIO', unit: 'Cái', price: 300000, qty: 4 },
  { code: 'AUDIO-008', name: 'Main Công Suất 4 Kênh', cat: 'AUDIO', unit: 'Cái', price: 600000, qty: 3 },

  // LIGHT
  { code: 'LIGHT-001', name: 'Controller Tiger Touch', cat: 'LIGHT', unit: 'Cái', price: 900000, qty: 2 },
  { code: 'LIGHT-002', name: 'Controller MA2', cat: 'LIGHT', unit: 'Cái', price: 1500000, qty: 1 },
  { code: 'LIGHT-003', name: 'Đèn Movinghead Spot 1000W', cat: 'LIGHT', unit: 'Cái', price: 1000000, qty: 10 },
  { code: 'LIGHT-004', name: 'Đèn Movinghead Spot 400W', cat: 'LIGHT', unit: 'Cái', price: 700000, qty: 15 },
  { code: 'LIGHT-005', name: 'Đèn Movinghead Beam 260W', cat: 'LIGHT', unit: 'Cái', price: 200000, qty: 20 },
  { code: 'LIGHT-006', name: 'Đèn Par LED 1810', cat: 'LIGHT', unit: 'Cái', price: 80000, qty: 40 },
  { code: 'LIGHT-007', name: 'Đèn Big Eye 1915', cat: 'LIGHT', unit: 'Cái', price: 200000, qty: 8 },
  { code: 'LIGHT-008', name: 'Đèn Katana 1240', cat: 'LIGHT', unit: 'Cái', price: 200000, qty: 6 },

  // LED
  { code: 'LED-001', name: 'Led P3.91 Indoor (Cabin 500x500)', cat: 'LED', unit: 'Mét', price: 600000, qty: 50 },
  { code: 'LED-002', name: 'Led P3.91 Outdoor (Cabin 500x500)', cat: 'LED', unit: 'Mét', price: 900000, qty: 30 },
  { code: 'LED-003', name: 'Magnimage MH570', cat: 'LED', unit: 'Bộ', price: 1000000, qty: 2 },
  { code: 'LED-004', name: 'Magnimage EC40', cat: 'LED', unit: 'Bộ', price: 5000000, qty: 1 },
  { code: 'LED-005', name: 'Cardsen Nova MCTRL600', cat: 'LED', unit: 'Bộ', price: 1000000, qty: 3 },

  // MATRIX
  { code: 'MATRIX-001', name: 'Led Matrix Dây ICSJ-10060 RGB-DMX', cat: 'MATRIX', unit: 'Mét', price: 120000, qty: 100 },
  { code: 'MATRIX-002', name: 'Artnet 16 Port', cat: 'MATRIX', unit: 'Cái', price: 0, qty: 4 },
  { code: 'MATRIX-003', name: 'Máy Tính Lập Trình MSI Stealth 14 AI Studio', cat: 'MATRIX', unit: 'Cái', price: 0, qty: 1 },

  // STAGE
  { code: 'STAGE-001', name: 'Kính Cường Lực 12mm - Cho Thuê', cat: 'STAGE', unit: 'M2', price: 150000, qty: 200 },
  { code: 'STAGE-002', name: 'Ván MDF - Cho Thuê', cat: 'STAGE', unit: 'M2', price: 90000, qty: 300 },
  { code: 'STAGE-003', name: 'Sàn Nhôm', cat: 'STAGE', unit: 'M2', price: 0, qty: 150 },
];

function seed() {
  const existingCats = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (existingCats.c > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const insertCat = db.prepare('INSERT INTO categories (name, code, icon) VALUES (?, ?, ?)');
  const insertEq  = db.prepare(`
    INSERT INTO equipment (code, name, category_id, unit, unit_price, qty_total, qty_available)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seeder = db.transaction(() => {
    for (const c of categories) insertCat.run(c.name, c.code, c.icon);

    const catMap = {};
    db.prepare('SELECT id, code FROM categories').all().forEach(r => { catMap[r.code] = r.id; });

    for (const e of equipment) {
      insertEq.run(e.code, e.name, catMap[e.cat], e.unit, e.price, e.qty, e.qty);
    }
  });

  seeder();
  console.log(`Seeded ${categories.length} categories and ${equipment.length} equipment items.`);
}

seed();
