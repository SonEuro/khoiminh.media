-- ============================================================
-- ĐÁNH GIÁ VÀ SỬA SỐ LIỆU TỒN KHO SAU LỖI CHUYỂN THIẾT BỊ
-- Chạy: sqlite3 db.sqlite < reconcile-stock.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- BƯỚC 1: CHẨN ĐOÁN — hiển thị sai số trước khi sửa
-- ──────────────────────────────────────────────────────────
.mode column
.headers on
.width 4 30 5 12 12 12 13 13

SELECT
  e.id,
  e.name,
  e.unit,
  e.qty_in_use   AS in_use_cũ,
  (
    SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                             THEN ti.quantity ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                             THEN ti.quantity ELSE 0 END), 0)
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE ti.equipment_id = e.id
  ) AS in_use_đúng,
  e.qty_available AS available_cũ,
  e.qty_total
    - MAX(0, (
        SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                               THEN ti.quantity ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                               THEN ti.quantity ELSE 0 END), 0)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.equipment_id = e.id
      ))
    - e.qty_damaged - e.qty_maintenance - e.qty_lost
  AS available_đúng
FROM equipment e
WHERE
  e.qty_in_use != MAX(0, (
    SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                             THEN ti.quantity ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                             THEN ti.quantity ELSE 0 END), 0)
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE ti.equipment_id = e.id
  ))
ORDER BY ABS(e.qty_in_use - (
  SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE ti.equipment_id = e.id
)) DESC;

SELECT '--- Tổng số thiết bị có sai số: ' ||
  COUNT(*) || ' ---' AS ket_qua
FROM equipment e
WHERE e.qty_in_use != MAX(0, (
  SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE ti.equipment_id = e.id
));


-- ──────────────────────────────────────────────────────────
-- BƯỚC 2: SỬA — cập nhật qty_in_use từ lịch sử giao dịch
-- ──────────────────────────────────────────────────────────
BEGIN;

UPDATE equipment
SET qty_in_use = MAX(0, (
  SELECT COALESCE(SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                           THEN ti.quantity ELSE 0 END), 0)
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE ti.equipment_id = equipment.id
));

-- Tính lại qty_available dựa trên qty_in_use vừa cập nhật
UPDATE equipment
SET qty_available = MAX(0, qty_total - qty_in_use - qty_damaged - qty_maintenance - qty_lost);

COMMIT;

SELECT '✅ Đã sửa xong. Kết quả sau khi cập nhật:' AS thong_bao;


-- ──────────────────────────────────────────────────────────
-- BƯỚC 3: XÁC NHẬN — kiểm tra lại sau khi sửa
-- ──────────────────────────────────────────────────────────
SELECT
  e.id,
  e.name,
  e.qty_total,
  e.qty_available,
  e.qty_in_use,
  e.qty_damaged,
  e.qty_maintenance,
  e.qty_lost,
  e.qty_total - e.qty_available - e.qty_in_use - e.qty_damaged - e.qty_maintenance - e.qty_lost AS kiem_tra_0
FROM equipment e
WHERE e.qty_total - e.qty_available - e.qty_in_use - e.qty_damaged - e.qty_maintenance - e.qty_lost != 0
ORDER BY e.name;

SELECT '✅ Không còn sai số nào.' AS ket_qua
WHERE NOT EXISTS (
  SELECT 1 FROM equipment e
  WHERE e.qty_total - e.qty_available - e.qty_in_use - e.qty_damaged - e.qty_maintenance - e.qty_lost != 0
);
