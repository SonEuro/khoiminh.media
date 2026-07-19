'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');

// GET /api/staff-flags — trả về danh sách có van_phong = 1
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT name FROM staff_flags WHERE van_phong = 1').all();
  res.json({ vanPhong: rows.map(r => r.name) });
});

// POST /api/staff-flags/toggle — { name, vanPhong: true/false }
router.post('/toggle', requireAuth, (req, res) => {
  const { name, vanPhong } = req.body;
  if (!name) return res.status(400).json({ error: 'Thiếu name' });
  db.prepare(`
    INSERT INTO staff_flags (name, van_phong) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET van_phong = excluded.van_phong
  `).run(name, vanPhong ? 1 : 0);
  res.json({ ok: true });
});

module.exports = router;
