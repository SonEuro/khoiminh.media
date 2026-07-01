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

export const FREELANCER_GROUPS = [
  { dept: 'Âm Thanh Ánh Sáng', members: [
    'Đặng Hoàng Bi', 'Đỗ Hoàng Anh', 'Đỗ Thành Quang', 'Đoàn Quốc Vũ',
    'Lê Nguyễn Minh Kỳ', 'Ngô Công Thành Danh', 'Nguyễn Hữu Quang',
    'Nguyễn Ngọc Đăng Khoa', 'Nguyễn Thanh Tài', 'Nguyễn Văn Huy',
    'Nguyễn Văn Tồn', 'Phạm Trắc', 'Trần Đình Quang', 'Trần Quang Nhật',
    'Phạm Hữu Thuận', 'Nguyễn Lê Hoàng', 'Phan Văn Tân',
  ]},
  { dept: 'Sân Khấu', members: [
    'Hà Văn Lộc', 'Lâm Văn Khánh', 'Nguyễn Anh Hoàng', 'Nguyễn Phúc Vinh',
    'Nguyễn Thành Nghĩa', 'Nguyẽn Trình Cát Long', 'Nguyễn Trung Tín',
    'Nguyễn Văn Dũng', 'Nguyễn Văn Hậu', 'Phan Đình Phước',
    'Phan Quốc Tuấn', 'Nguyễn Văn Nam',
  ]},
  { dept: 'Kỹ Thuật', members: [
    'Đinh Vĩnh Hảo', 'Hoàng Tuấn Linh', 'Mai Đức Anh Quang', 'Mai Đức Minh Quang',
    'Nguyễn Chí Sơn', 'Nguyễn Trương Hạ Nguyên', 'Nguyễn Duy Khanh', 'Nguyễn Duy Vũ',
    'Nguyễn Hoài Nam', 'Nguyễn Hoàng Nam', 'Nguyễn Minh Duy', 'Nguyễn Thanh Phong',
    'Nguyễn Thanh Tâm', 'Nguyễn Trung Tuyến', 'Nguyễn Võ Hạnh Phúc', 'Vi Minh Gia Bảo',
    'Võ Đức Hoà', 'Huỳnh Văn Nam', 'Lê Bá Đại Thành', 'Lê Ngọc Tuấn Kiệt',
    'Lê Quốc Toàn', 'Lê Văn Tuấn', 'Nguyễn Lê Nhu', 'Nguyễn Lê Trung Nghĩa',
    'Nguyễn Mậu Nam', 'Nguyễn Ngọc Thái', 'Nguyễn Nhựt Duy', 'Nguyễn Phước Sang',
    'Nguyễn Quốc Trung - Nát', 'Nguyễn Quốc Trung', 'Nguyễn Văn Dụ', 'Nguyễn Văn Hiệu',
    'Phan Minh Trí', 'Trần Minh Nguyên', 'Trần Trung Kiên', 'Vũ Minh Anh',
    'Đỗ Ngô Trung Hiếu', 'Hoàng Hải', 'Nguyễn Trọng Nhân', 'Nguyễn Bảo Trọng', 'Nguyễn Tiến',
  ]},
  { dept: 'Quay Phim', members: [
    'Hứa Khắc Tuân', 'Hứa Anh Đức', 'Đặng Đình Bảo', 'Nguyễn Quang Huy',
    'Huỳnh Trung Quân', 'Nguyễn Hồng Nam', 'Huỳnh Châu Thông', 'Lê Đức Thành',
    'Nguyễn Phi Vũ', 'Nguyễn Tấn Đạt', 'Nguyễn Tấn Lực', 'Nguyễn Trung Kiên',
    'Lê Văn Hải', 'Trần Minh Luân', 'Nguyễn Xuân Vinh', 'Phạm Công Năng',
    'Nguyễn Lâm Thiên Nhân', 'Phạm Văn Hoàng', 'Phạm Văn Vững', 'Nguyễn Tấn Lanh',
    'Đinh Hữu Trí', 'Nguyễn Tấn Tài', 'Mai Nguyễn Văn Khoa', 'Nguyễn Anh Thành',
    'Tống Hoàng Lộc', 'Phan Thanh Duy', 'Nguyễn Tấn Phước', 'Huỳnh Phi Công',
    'Vũ Văn Hường', 'Diệp Phước Thành', 'Đoàn Văn Huy', 'Hứa Duy Trung',
    'Phạm Quốc Tấn', 'Mai Tiến Đạt', 'Nguyễn Hoàng Duy Minh', 'Trần Quốc Huy',
  ]},
  { dept: 'Sản Xuất', members: ['Phan Khánh Hà', 'Lưu Thị Ngọc Lam'] },
];
