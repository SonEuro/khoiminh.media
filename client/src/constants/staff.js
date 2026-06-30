export const DEPARTMENTS = [
  'Âm Thanh Ánh Sáng',
  'Sân Khấu',
  'Kỹ Thuật',
  'Cơ Sở Vật Chất',
  'Kế Toán',
  'Kinh Doanh',
];

export const KM_STAFF_GROUPS = [
  { dept: 'Cơ Sở Vật Chất', members: ['Đào Chí Hải', 'Ngô Văn Hào'] },
  { dept: 'Âm Thanh Ánh Sáng', members: [
    'Hà Minh Tâm', 'Trần Nhật Duy', 'Lê Trần Hoài Vĩ',
    'Huỳnh Sự', 'Trương Lê Trung Tín', 'Lê Trọng Đức',
  ]},
  { dept: 'Sân Khấu', members: [
    'Trần Duy Hùng', 'Nguyễn Trường Chinh', 'Hứa Khắc Cần',
    'Phạm Đăng Sinh', 'Nguyễn Ngọc Ly', 'Phạm Hữu Phúc Khang',
  ]},
  { dept: 'Kỹ Thuật', members: [
    'Nguyễn Văn Linh', 'Nguyễn Trí Tài', 'Võ Chí Thiện',
    'Lê Anh Kiệt', 'Nguyễn Thanh Sang', 'Phan Khắc Luyện',
    'Vũ Đức Tài', 'Đỗ Quý Vượng', 'Nguyễn Thành Trung',
    'Phan Ngọc Mạnh', 'Trần Đình Cương', 'Hồ Văn Toàn',
    'Hồ Bảo Trường', 'Trần Triệu Vĩ', 'Hoàng Văn Tuân',
  ]},
  { dept: 'Kế Toán', members: [
    'Đào Thái Hiền', 'Vũ Thị Hà', 'Lâm Kiều Duyên',
    'Nguyễn Thị Anh Thư', 'Nguyễn Kim Huệ',
  ]},
  { dept: 'Kinh Doanh', members: ['Nguyễn Thế Sơn', 'Lâm Tấn Nhân', 'Đào Nguyên Sơn'] },
];

export const ALL_KM_STAFF = KM_STAFF_GROUPS.flatMap(g => g.members);
