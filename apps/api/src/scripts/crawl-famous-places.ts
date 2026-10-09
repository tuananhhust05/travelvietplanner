/**
 * Crawl famous Vietnamese tourist destinations from Wikipedia.
 *
 * Uses a curated list of well-known destinations (name + province + type + coords)
 * and enriches each with a Vietnamese Wikipedia summary, extract, and cover image.
 *
 * Output: src/scripts/data/famous-places-raw.json
 *
 * Usage: npx tsx src/scripts/crawl-famous-places.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RATE_LIMIT_MS = 150;
const WIKI_REST = 'https://vi.wikipedia.org/api/rest_v1/page/summary';
const WIKI_API = 'https://vi.wikipedia.org/w/api.php';

export interface FamousPlace {
  name: string;
  province: string;
  type: string;
  lat: number;
  lng: number;
  wikiTitle: string;
  summary: string;
  content: string;
  coverUrl: string | null;
  sourceUrl: string;
}

// Curated list of famous Vietnamese tourist destinations.
// type maps to places.type: beach|mountain|attraction|landmark|island|park|area
const FAMOUS: { name: string; province: string; type: string; lat: number; lng: number; wikiTitle: string }[] = [
  // === Miền Bắc ===
  { name: 'Vịnh Hạ Long', province: 'Tỉnh Quảng Ninh', type: 'area', lat: 20.9101, lng: 107.1839, wikiTitle: 'Vịnh Hạ Long' },
  { name: 'Vịnh Lan Hạ', province: 'Tỉnh Quảng Ninh', type: 'area', lat: 20.7833, lng: 107.0833, wikiTitle: 'Vịnh Lan Hạ' },
  { name: 'Đảo Cát Bà', province: 'Thành phố Hải Phòng', type: 'island', lat: 20.795, lng: 107.0, wikiTitle: 'Cát Bà' },
  { name: 'Vịnh Bái Tử Long', province: 'Tỉnh Quảng Ninh', type: 'area', lat: 21.0, lng: 107.4, wikiTitle: 'Vịnh Bái Tử Long' },
  { name: 'Đảo Cô Tô', province: 'Tỉnh Quảng Ninh', type: 'island', lat: 21.0167, lng: 107.7667, wikiTitle: 'Cô Tô' },
  { name: 'Yên Tử', province: 'Tỉnh Quảng Ninh', type: 'landmark', lat: 21.1667, lng: 106.7167, wikiTitle: 'Yên Tử' },
  { name: 'Sa Pa', province: 'Tỉnh Lào Cai', type: 'area', lat: 22.3333, lng: 103.8333, wikiTitle: 'Sa Pa' },
  { name: 'Núi Fansipan', province: 'Tỉnh Lào Cai', type: 'mountain', lat: 22.3033, lng: 103.775, wikiTitle: 'Fansipan' },
  { name: 'Thác Bạc Sa Pa', province: 'Tỉnh Lào Cai', type: 'attraction', lat: 22.35, lng: 103.79, wikiTitle: 'Thác Bạc' },
  { name: 'Mù Cang Chải', province: 'Tỉnh Yên Bái', type: 'area', lat: 21.8333, lng: 104.0833, wikiTitle: 'Mù Cang Chải' },
  { name: 'Ruộng bậc thang Mù Cang Chải', province: 'Tỉnh Yên Bái', type: 'area', lat: 21.85, lng: 104.1, wikiTitle: 'Ruộng bậc thang Mù Cang Chải' },
  { name: 'Thác Pú Nhu', province: 'Tỉnh Yên Bái', type: 'attraction', lat: 21.9, lng: 104.3, wikiTitle: 'Thác Pú Nhu' },
  { name: 'Cao nguyên đá Đồng Văn', province: 'Tỉnh Hà Giang', type: 'area', lat: 23.2833, lng: 105.35, wikiTitle: 'Cao nguyên đá Đồng Văn' },
  { name: 'Cột cờ Lũng Cú', province: 'Tỉnh Hà Giang', type: 'landmark', lat: 23.3667, lng: 105.3167, wikiTitle: 'Cột cờ Lũng Cú' },
  { name: 'Dốc Thẩm Mã', province: 'Tỉnh Hà Giang', type: 'attraction', lat: 23.1, lng: 105.2, wikiTitle: 'Dốc Thẩm Mã' },
  { name: 'Đèo Mã Pí Lèng', province: 'Tỉnh Hà Giang', type: 'attraction', lat: 23.2, lng: 105.4, wikiTitle: 'Mã Pí Lèng' },
  { name: 'Thác Bản Giốc', province: 'Tỉnh Cao Bằng', type: 'attraction', lat: 22.85, lng: 106.7167, wikiTitle: 'Thác Bản Giốc' },
  { name: 'Hang Pắc Pó', province: 'Tỉnh Cao Bằng', type: 'landmark', lat: 22.7, lng: 106.0, wikiTitle: 'Pắc Pó' },
  { name: 'Hồ Ba Bể', province: 'Tỉnh Bắc Kạn', type: 'area', lat: 22.4, lng: 105.6167, wikiTitle: 'Hồ Ba Bể' },
  { name: 'Tam Đảo', province: 'Tỉnh Vĩnh Phúc', type: 'area', lat: 21.4667, lng: 105.65, wikiTitle: 'Tam Đảo' },
  { name: 'Hồ Núi Cốc', province: 'Tỉnh Thái Nguyên', type: 'area', lat: 21.55, lng: 105.65, wikiTitle: 'Hồ Núi Cốc' },
  { name: 'Hồ Thác Bà', province: 'Tỉnh Yên Bái', type: 'area', lat: 21.75, lng: 105.0, wikiTitle: 'Hồ Thác Bà' },
  { name: 'Tây Thiên', province: 'Tỉnh Vĩnh Phúc', type: 'landmark', lat: 21.35, lng: 105.55, wikiTitle: 'Tây Thiên' },
  { name: 'Chùa Hương', province: 'Thành phố Hà Nội', type: 'landmark', lat: 20.6167, lng: 105.75, wikiTitle: 'Chùa Hương' },
  { name: 'Hồ Hoàn Kiếm', province: 'Thành phố Hà Nội', type: 'area', lat: 21.0285, lng: 105.8522, wikiTitle: 'Hồ Hoàn Kiếm' },
  { name: 'Văn Miếu - Quốc Tử Giám', province: 'Thành phố Hà Nội', type: 'landmark', lat: 21.0292, lng: 105.8361, wikiTitle: 'Văn Miếu – Quốc Tử Giám' },
  { name: 'Lăng Chủ tịch Hồ Chí Minh', province: 'Thành phố Hà Nội', type: 'landmark', lat: 21.0367, lng: 105.8344, wikiTitle: 'Lăng Chủ tịch Hồ Chí Minh' },
  { name: 'Hoàng thành Thăng Long', province: 'Thành phố Hà Nội', type: 'landmark', lat: 21.0333, lng: 105.8333, wikiTitle: 'Hoàng thành Thăng Long' },
  { name: 'Hồ Tây', province: 'Thành phố Hà Nội', type: 'area', lat: 21.0667, lng: 105.8167, wikiTitle: 'Hồ Tây' },
  { name: 'Chùa Một Cột', province: 'Thành phố Hà Nội', type: 'landmark', lat: 21.0358, lng: 105.8333, wikiTitle: 'Chùa Một Cột' },
  { name: 'Nhà thờ Lớn Hà Nội', province: 'Thành phố Hà Nội', type: 'landmark', lat: 21.0286, lng: 105.8497, wikiTitle: 'Nhà thờ Lớn Hà Nội' },
  { name: 'Phố cổ Hà Nội', province: 'Thành phố Hà Nội', type: 'area', lat: 21.0333, lng: 105.85, wikiTitle: 'Phố cổ Hà Nội' },
  { name: 'Hồ Gươm', province: 'Thành phố Hà Nội', type: 'area', lat: 21.0285, lng: 105.8522, wikiTitle: 'Hồ Gươm' },
  { name: 'Ninh Bình', province: 'Tỉnh Ninh Bình', type: 'area', lat: 20.25, lng: 105.9667, wikiTitle: 'Ninh Bình' },
  { name: 'Tràng An', province: 'Tỉnh Ninh Bình', type: 'area', lat: 20.25, lng: 105.9, wikiTitle: 'Tràng An' },
  { name: 'Tam Cốc - Bích Động', province: 'Tỉnh Ninh Bình', type: 'area', lat: 20.2167, lng: 105.9167, wikiTitle: 'Tam Cốc – Bích Động' },
  { name: 'Cố đô Hoa Lư', province: 'Tỉnh Ninh Bình', type: 'landmark', lat: 20.2833, lng: 105.8833, wikiTitle: 'Hoa Lư' },
  { name: 'Chùa Bái Đính', province: 'Tỉnh Ninh Bình', type: 'landmark', lat: 20.25, lng: 105.8833, wikiTitle: 'Chùa Bái Đính' },
  { name: 'Hang Múa', province: 'Tỉnh Ninh Bình', type: 'attraction', lat: 20.2, lng: 105.9, wikiTitle: 'Hang Múa' },
  { name: 'Đền Trần', province: 'Tỉnh Nam Định', type: 'landmark', lat: 20.4, lng: 106.1667, wikiTitle: 'Đền Trần (Nam Định)' },
  { name: 'Biển Sầm Sơn', province: 'Tỉnh Thanh Hoá', type: 'beach', lat: 19.7333, lng: 105.9, wikiTitle: 'Sầm Sơn' },
  { name: 'Thành nhà Hồ', province: 'Tỉnh Thanh Hoá', type: 'landmark', lat: 20.0667, lng: 105.6, wikiTitle: 'Thành nhà Hồ' },
  { name: 'Pù Luông', province: 'Tỉnh Thanh Hoá', type: 'area', lat: 20.5, lng: 105.2, wikiTitle: 'Pù Luông' },
  { name: 'Biển Cửa Lò', province: 'Tỉnh Nghệ An', type: 'beach', lat: 18.8, lng: 105.7167, wikiTitle: 'Cửa Lò' },
  { name: 'Quê Bác Hồ', province: 'Tỉnh Nghệ An', type: 'landmark', lat: 18.8, lng: 105.65, wikiTitle: 'Kim Liên (Nam Đàn)' },
  { name: 'Phong Nha - Kẻ Bàng', province: 'Tỉnh Quảng Bình', type: 'area', lat: 17.5333, lng: 106.15, wikiTitle: 'Vườn quốc gia Phong Nha – Kẻ Bàng' },
  { name: 'Động Phong Nha', province: 'Tỉnh Quảng Bình', type: 'attraction', lat: 17.5833, lng: 106.2833, wikiTitle: 'Động Phong Nha' },
  { name: 'Động Thiên Đường', province: 'Tỉnh Quảng Bình', type: 'attraction', lat: 17.5167, lng: 106.2167, wikiTitle: 'Động Thiên Đường' },
  { name: 'Sơn Đoòng', province: 'Tỉnh Quảng Bình', type: 'attraction', lat: 17.4667, lng: 106.3167, wikiTitle: 'Hang Sơn Đoòng' },
  { name: 'Biển Nhật Lệ', province: 'Tỉnh Quảng Bình', type: 'beach', lat: 17.4667, lng: 106.6167, wikiTitle: 'Nhật Lệ' },

  // === Miền Trung ===
  { name: 'Đại Nội Huế', province: 'Thành phố Huế', type: 'landmark', lat: 16.4694, lng: 107.5778, wikiTitle: 'Hoàng thành Huế' },
  { name: 'Chùa Thiên Mụ', province: 'Thành phố Huế', type: 'landmark', lat: 16.4536, lng: 107.5444, wikiTitle: 'Chùa Thiên Mụ' },
  { name: 'Lăng Khải Định', province: 'Thành phố Huế', type: 'landmark', lat: 16.3833, lng: 107.5667, wikiTitle: 'Lăng Khải Định' },
  { name: 'Lăng Tự Đức', province: 'Thành phố Huế', type: 'landmark', lat: 16.4333, lng: 107.5667, wikiTitle: 'Lăng Tự Đức' },
  { name: 'Cầu Trường Tiền', province: 'Thành phố Huế', type: 'landmark', lat: 16.4667, lng: 107.5833, wikiTitle: 'Cầu Trường Tiền' },
  { name: 'Biển Thuận An', province: 'Thành phố Huế', type: 'beach', lat: 16.55, lng: 107.65, wikiTitle: 'Thuận An (Huế)' },
  { name: 'Bà Nà Hills', province: 'Thành phố Đà Nẵng', type: 'area', lat: 16.0, lng: 107.9833, wikiTitle: 'Bà Nà' },
  { name: 'Cầu Vàng', province: 'Thành phố Đà Nẵng', type: 'landmark', lat: 16.0, lng: 107.9833, wikiTitle: 'Cầu Vàng' },
  { name: 'Bán đảo Sơn Trà', province: 'Thành phố Đà Nẵng', type: 'area', lat: 16.1, lng: 108.25, wikiTitle: 'Sơn Trà' },
  { name: 'Ngũ Hành Sơn', province: 'Thành phố Đà Nẵng', type: 'landmark', lat: 16.0, lng: 108.2667, wikiTitle: 'Ngũ Hành Sơn' },
  { name: 'Bãi biển Mỹ Khê', province: 'Thành phố Đà Nẵng', type: 'beach', lat: 16.05, lng: 108.25, wikiTitle: 'Mỹ Khê' },
  { name: 'Cầu Rồng', province: 'Thành phố Đà Nẵng', type: 'landmark', lat: 16.0611, lng: 108.2278, wikiTitle: 'Cầu Rồng' },
  { name: 'Phố cổ Hội An', province: 'Tỉnh Quảng Nam', type: 'area', lat: 15.8833, lng: 108.3333, wikiTitle: 'Hội An' },
  { name: 'Thánh địa Mỹ Sơn', province: 'Tỉnh Quảng Nam', type: 'landmark', lat: 15.7667, lng: 108.1167, wikiTitle: 'Thánh địa Mỹ Sơn' },
  { name: 'Biển An Bàng', province: 'Tỉnh Quảng Nam', type: 'beach', lat: 15.9167, lng: 108.35, wikiTitle: 'An Bàng' },
  { name: 'Cù Lao Chàm', province: 'Tỉnh Quảng Nam', type: 'island', lat: 15.95, lng: 108.5, wikiTitle: 'Cù Lao Chàm' },
  { name: 'Lý Sơn', province: 'Tỉnh Quảng Ngãi', type: 'island', lat: 15.3833, lng: 109.1167, wikiTitle: 'Lý Sơn' },
  { name: 'Quy Nhơn', province: 'Tỉnh Bình Định', type: 'area', lat: 13.7667, lng: 109.2333, wikiTitle: 'Quy Nhơn' },
  { name: 'Kỳ Co', province: 'Tỉnh Bình Định', type: 'beach', lat: 13.85, lng: 109.3, wikiTitle: 'Kỳ Co' },
  { name: 'Ghềnh Ráng', province: 'Tỉnh Bình Định', type: 'beach', lat: 13.75, lng: 109.25, wikiTitle: 'Ghềnh Ráng' },
  { name: 'Tháp Bánh Ít', province: 'Tỉnh Bình Định', type: 'landmark', lat: 13.9, lng: 109.1, wikiTitle: 'Tháp Bánh Ít' },
  { name: 'Mũi Điện', province: 'Tỉnh Phú Yên', type: 'landmark', lat: 12.8833, lng: 109.45, wikiTitle: 'Mũi Điện' },
  { name: 'Ghềnh Đá Đĩa', province: 'Tỉnh Phú Yên', type: 'attraction', lat: 13.0, lng: 109.35, wikiTitle: 'Ghềnh Đá Đĩa' },
  { name: 'Vịnh Vũng Rô', province: 'Tỉnh Phú Yên', type: 'area', lat: 12.9167, lng: 109.4, wikiTitle: 'Vũng Rô' },
  { name: 'Nha Trang', province: 'Tỉnh Khánh Hoà', type: 'area', lat: 12.25, lng: 109.1833, wikiTitle: 'Nha Trang' },
  { name: 'Vịnh Nha Trang', province: 'Tỉnh Khánh Hoà', type: 'area', lat: 12.25, lng: 109.2, wikiTitle: 'Vịnh Nha Trang' },
  { name: 'Hòn Tre', province: 'Tỉnh Khánh Hoà', type: 'island', lat: 12.2, lng: 109.3, wikiTitle: 'Hòn Tre' },
  { name: 'Vinpearl Land Nha Trang', province: 'Tỉnh Khánh Hoà', type: 'attraction', lat: 12.2167, lng: 109.3, wikiTitle: 'Vinpearl Land' },
  { name: 'Tháp Bà Ponagar', province: 'Tỉnh Khánh Hoà', type: 'landmark', lat: 12.2667, lng: 109.2, wikiTitle: 'Tháp Bà Ponagar' },
  { name: 'Đảo Bình Ba', province: 'Tỉnh Khánh Hoà', type: 'island', lat: 12.0, lng: 109.2, wikiTitle: 'Bình Ba' },
  { name: 'Vịnh Vân Phong', province: 'Tỉnh Khánh Hoà', type: 'area', lat: 12.6, lng: 109.3, wikiTitle: 'Vịnh Vân Phong' },
  { name: 'Mũi Né', province: 'Tỉnh Bình Thuận', type: 'beach', lat: 10.9333, lng: 108.3, wikiTitle: 'Mũi Né' },
  { name: 'Đồi cát bay Mũi Né', province: 'Tỉnh Bình Thuận', type: 'attraction', lat: 10.95, lng: 108.3, wikiTitle: 'Đồi cát Mũi Né' },
  { name: 'Suối Tiên Mũi Né', province: 'Tỉnh Bình Thuận', type: 'attraction', lat: 10.9, lng: 108.3, wikiTitle: 'Suối Tiên (Mũi Né)' },
  { name: 'Phan Thiết', province: 'Tỉnh Bình Thuận', type: 'area', lat: 10.9333, lng: 108.1, wikiTitle: 'Phan Thiết' },
  { name: 'Đà Lạt', province: 'Tỉnh Lâm Đồng', type: 'area', lat: 11.9333, lng: 108.4333, wikiTitle: 'Đà Lạt' },
  { name: 'Hồ Xuân Hương', province: 'Tỉnh Lâm Đồng', type: 'area', lat: 11.9333, lng: 108.4333, wikiTitle: 'Hồ Xuân Hương' },
  { name: 'Thung lũng Tình Yêu', province: 'Tỉnh Lâm Đồng', type: 'attraction', lat: 11.95, lng: 108.45, wikiTitle: 'Thung lũng Tình Yêu' },
  { name: 'Thác Datanla', province: 'Tỉnh Lâm Đồng', type: 'attraction', lat: 11.9, lng: 108.45, wikiTitle: 'Thác Datanla' },
  { name: 'Thác Prenn', province: 'Tỉnh Lâm Đồng', type: 'attraction', lat: 11.85, lng: 108.4, wikiTitle: 'Thác Prenn' },
  { name: 'Lang Biang', province: 'Tỉnh Lâm Đồng', type: 'mountain', lat: 12.05, lng: 108.4333, wikiTitle: 'Lang Biang' },
  { name: 'Thiền viện Trúc Lâm', province: 'Tỉnh Lâm Đồng', type: 'landmark', lat: 11.9, lng: 108.45, wikiTitle: 'Thiền viện Trúc Lâm' },
  { name: 'Cù Lao Xanh', province: 'Tỉnh Bình Định', type: 'island', lat: 13.9, lng: 109.4, wikiTitle: 'Cù Lao Xanh' },
  { name: 'Đảo Phú Quý', province: 'Tỉnh Bình Thuận', type: 'island', lat: 10.5167, lng: 108.9333, wikiTitle: 'Phú Quý' },
  { name: 'Vườn quốc gia Yok Đôn', province: 'Tỉnh Đắk Lắk', type: 'park', lat: 12.85, lng: 107.7, wikiTitle: 'Vườn quốc gia Yok Đôn' },
  { name: 'Hồ Lắk', province: 'Tỉnh Đắk Lắk', type: 'area', lat: 12.4167, lng: 108.1833, wikiTitle: 'Hồ Lắk' },
  { name: 'Buôn Ma Thuột', province: 'Tỉnh Đắk Lắk', type: 'area', lat: 12.6667, lng: 108.05, wikiTitle: 'Buôn Ma Thuột' },
  { name: 'Kon Tum', province: 'Tỉnh Kon Tum', type: 'area', lat: 14.35, lng: 108.0, wikiTitle: 'Kon Tum' },
  { name: 'Măng Đen', province: 'Tỉnh Kon Tum', type: 'area', lat: 14.4, lng: 108.3, wikiTitle: 'Măng Đen' },
  { name: 'Pleiku', province: 'Tỉnh Gia Lai', type: 'area', lat: 13.9833, lng: 108.0, wikiTitle: 'Pleiku' },
  { name: 'Biển Hồ Pleiku', province: 'Tỉnh Gia Lai', type: 'area', lat: 14.0, lng: 108.0, wikiTitle: 'Biển Hồ' },

  // === Miền Nam ===
  { name: 'Thành phố Hồ Chí Minh', province: 'Thành phố Hồ Chí Minh', type: 'area', lat: 10.8231, lng: 106.6297, wikiTitle: 'Thành phố Hồ Chí Minh' },
  { name: 'Chợ Bến Thành', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.7728, lng: 106.6981, wikiTitle: 'Chợ Bến Thành' },
  { name: 'Dinh Độc Lập', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.7772, lng: 106.6953, wikiTitle: 'Dinh Độc Lập' },
  { name: 'Nhà thờ Đức Bà', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.7797, lng: 106.6992, wikiTitle: 'Nhà thờ Đức Bà Sài Gòn' },
  { name: 'Bưu điện Thành phố', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.7797, lng: 106.7, wikiTitle: 'Bưu điện trung tâm Sài Gòn' },
  { name: 'Bến Nhà Rồng', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.7689, lng: 106.7061, wikiTitle: 'Bến Nhà Rồng' },
  { name: 'Chợ Bình Tây', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 10.75, lng: 106.65, wikiTitle: 'Chợ Bình Tây' },
  { name: 'Suối Tiên', province: 'Thành phố Hồ Chí Minh', type: 'attraction', lat: 10.8667, lng: 106.8, wikiTitle: 'Khu du lịch Văn hóa Suối Tiên' },
  { name: 'Củ Chi', province: 'Thành phố Hồ Chí Minh', type: 'landmark', lat: 11.05, lng: 106.5, wikiTitle: 'Địa đạo Củ Chi' },
  { name: 'Cần Giờ', province: 'Thành phố Hồ Chí Minh', type: 'area', lat: 10.5, lng: 106.9, wikiTitle: 'Cần Giờ' },
  { name: 'Vũng Tàu', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'beach', lat: 10.35, lng: 107.0667, wikiTitle: 'Vũng Tàu' },
  { name: 'Bãi Trước Vũng Tàu', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'beach', lat: 10.35, lng: 107.0833, wikiTitle: 'Bãi Trước' },
  { name: 'Bãi Sau Vũng Tàu', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'beach', lat: 10.3333, lng: 107.1, wikiTitle: 'Bãi Sau' },
  { name: 'Tượng Chúa Kitô Vũng Tàu', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'landmark', lat: 10.3333, lng: 107.0833, wikiTitle: 'Tượng Chúa Kitô Vua' },
  { name: 'Côn Đảo', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'island', lat: 8.6833, lng: 106.6, wikiTitle: 'Côn Đảo' },
  { name: 'Hồ Tràm', province: 'Tỉnh Bà Rịa - Vũng Tàu', type: 'beach', lat: 10.45, lng: 107.4, wikiTitle: 'Hồ Tràm' },
  { name: 'Đảo Phú Quốc', province: 'Tỉnh Kiên Giang', type: 'island', lat: 10.2333, lng: 103.9667, wikiTitle: 'Phú Quốc' },
  { name: 'Bãi Sao Phú Quốc', province: 'Tỉnh Kiên Giang', type: 'beach', lat: 10.2, lng: 103.95, wikiTitle: 'Bãi Sao' },
  { name: 'Bãi Dài Phú Quốc', province: 'Tỉnh Kiên Giang', type: 'beach', lat: 10.3, lng: 103.9, wikiTitle: 'Bãi Dài' },
  { name: 'Hà Tiên', province: 'Tỉnh Kiên Giang', type: 'area', lat: 10.3833, lng: 104.4833, wikiTitle: 'Hà Tiên' },
  { name: 'Đảo Nam Du', province: 'Tỉnh Kiên Giang', type: 'island', lat: 9.7, lng: 104.3, wikiTitle: 'Nam Du' },
  { name: 'Rạch Giá', province: 'Tỉnh Kiên Giang', type: 'area', lat: 10.0167, lng: 105.0833, wikiTitle: 'Rạch Giá' },
  { name: 'Cần Thơ', province: 'Thành phố Cần Thơ', type: 'area', lat: 10.0333, lng: 105.7833, wikiTitle: 'Cần Thơ' },
  { name: 'Chợ nổi Cái Răng', province: 'Thành phố Cần Thơ', type: 'attraction', lat: 10.0, lng: 105.75, wikiTitle: 'Chợ nổi Cái Răng' },
  { name: 'Bến Ninh Kiều', province: 'Thành phố Cần Thơ', type: 'landmark', lat: 10.0333, lng: 105.7833, wikiTitle: 'Bến Ninh Kiều' },
  { name: 'Chợ nổi Phong Điền', province: 'Thành phố Cần Thơ', type: 'attraction', lat: 10.05, lng: 105.7, wikiTitle: 'Chợ nổi Phong Điền' },
  { name: 'Đồng Tháp Mười', province: 'Tỉnh Đồng Tháp', type: 'area', lat: 10.5, lng: 105.5, wikiTitle: 'Đồng Tháp Mười' },
  { name: 'Vườn quốc gia Tràm Chim', province: 'Tỉnh Đồng Tháp', type: 'park', lat: 10.65, lng: 105.5, wikiTitle: 'Vườn quốc gia Tràm Chim' },
  { name: 'Làng hoa Sa Đéc', province: 'Tỉnh Đồng Tháp', type: 'attraction', lat: 10.3, lng: 105.75, wikiTitle: 'Sa Đéc' },
  { name: 'Châu Đốc', province: 'Tỉnh An Giang', type: 'area', lat: 10.7, lng: 105.1167, wikiTitle: 'Châu Đốc' },
  { name: 'Núi Sam', province: 'Tỉnh An Giang', type: 'landmark', lat: 10.6833, lng: 105.1, wikiTitle: 'Núi Sam' },
  { name: 'Miếu Bà Chúa Xứ', province: 'Tỉnh An Giang', type: 'landmark', lat: 10.6833, lng: 105.1, wikiTitle: 'Miếu Bà Chúa Xứ' },
  { name: 'Rừng tràm Trà Sư', province: 'Tỉnh An Giang', type: 'park', lat: 10.55, lng: 105.05, wikiTitle: 'Rừng tràm Trà Sư' },
  { name: 'Cà Mau', province: 'Tỉnh Cà Mau', type: 'area', lat: 9.1833, lng: 105.15, wikiTitle: 'Cà Mau' },
  { name: 'Mũi Cà Mau', province: 'Tỉnh Cà Mau', type: 'landmark', lat: 8.6167, lng: 104.7, wikiTitle: 'Mũi Cà Mau' },
  { name: 'Vườn quốc gia U Minh Hạ', province: 'Tỉnh Cà Mau', type: 'park', lat: 9.0, lng: 105.0, wikiTitle: 'Vườn quốc gia U Minh Hạ' },
  { name: 'Đất Mũi', province: 'Tỉnh Cà Mau', type: 'landmark', lat: 8.6167, lng: 104.7, wikiTitle: 'Đất Mũi' },
  { name: 'Bạc Liêu', province: 'Tỉnh Bạc Liêu', type: 'area', lat: 9.2833, lng: 105.7167, wikiTitle: 'Bạc Liêu' },
  { name: 'Nhà công tử Bạc Liêu', province: 'Tỉnh Bạc Liêu', type: 'landmark', lat: 9.2833, lng: 105.7167, wikiTitle: 'Nhà công tử Bạc Liêu' },
  { name: 'Sóc Trăng', province: 'Tỉnh Sóc Trăng', type: 'area', lat: 9.6, lng: 105.9667, wikiTitle: 'Sóc Trăng' },
  { name: 'Chùa Dơi Sóc Trăng', province: 'Tỉnh Sóc Trăng', type: 'landmark', lat: 9.6, lng: 105.9667, wikiTitle: 'Chùa Dơi' },
  { name: 'Trà Vinh', province: 'Tỉnh Trà Vinh', type: 'area', lat: 9.9333, lng: 106.35, wikiTitle: 'Trà Vinh' },
  { name: 'Vĩnh Long', province: 'Tỉnh Vĩnh Long', type: 'area', lat: 10.25, lng: 105.9667, wikiTitle: 'Vĩnh Long' },
  { name: 'Bến Tre', province: 'Tỉnh Bến Tre', type: 'area', lat: 10.2333, lng: 106.3833, wikiTitle: 'Bến Tre' },
  { name: 'Tiền Giang', province: 'Tỉnh Tiền Giang', type: 'area', lat: 10.35, lng: 106.35, wikiTitle: 'Tiền Giang' },
  { name: 'Cù lao Thới Sơn', province: 'Tỉnh Tiền Giang', type: 'island', lat: 10.35, lng: 106.3, wikiTitle: 'Cù lao Thới Sơn' },
  { name: 'Long An', province: 'Tỉnh Long An', type: 'area', lat: 10.55, lng: 106.4, wikiTitle: 'Long An' },
  { name: 'Tây Ninh', province: 'Tỉnh Tây Ninh', type: 'area', lat: 11.3, lng: 106.1, wikiTitle: 'Tây Ninh' },
  { name: 'Núi Bà Đen', province: 'Tỉnh Tây Ninh', type: 'mountain', lat: 11.3833, lng: 106.1667, wikiTitle: 'Núi Bà Đen' },
  { name: 'Tòa Thánh Tây Ninh', province: 'Tỉnh Tây Ninh', type: 'landmark', lat: 11.3, lng: 106.1, wikiTitle: 'Tòa Thánh Tây Ninh' },
  { name: 'Bình Dương', province: 'Tỉnh Bình Dương', type: 'area', lat: 11.0, lng: 106.6667, wikiTitle: 'Bình Dương' },
  { name: 'Đồng Nai', province: 'Tỉnh Đồng Nai', type: 'area', lat: 11.1, lng: 107.0, wikiTitle: 'Đồng Nai' },
  { name: 'Vườn quốc gia Cát Tiên', province: 'Tỉnh Đồng Nai', type: 'park', lat: 11.4, lng: 107.4, wikiTitle: 'Vườn quốc gia Cát Tiên' },
  { name: 'Bình Phước', province: 'Tỉnh Bình Phước', type: 'area', lat: 11.75, lng: 106.9, wikiTitle: 'Bình Phước' },
  { name: 'Ninh Thuận', province: 'Tỉnh Ninh Thuận', type: 'area', lat: 11.5667, lng: 108.9833, wikiTitle: 'Ninh Thuận' },
  { name: 'Vịnh Vĩnh Hy', province: 'Tỉnh Ninh Thuận', type: 'area', lat: 11.8, lng: 109.2, wikiTitle: 'Vịnh Vĩnh Hy' },
  { name: 'Hang Rái', province: 'Tỉnh Ninh Thuận', type: 'attraction', lat: 11.6, lng: 109.2, wikiTitle: 'Hang Rái' },
  { name: 'Tháp Chàm Po Klong Garai', province: 'Tỉnh Ninh Thuận', type: 'landmark', lat: 11.6, lng: 108.95, wikiTitle: 'Tháp Po Klong Garai' },
  { name: 'Đảo Phú Quý', province: 'Tỉnh Bình Thuận', type: 'island', lat: 10.5167, lng: 108.9333, wikiTitle: 'Phú Quý' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function encodeWikiTitle(title: string): string {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

interface WikiSummaryResponse {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(title: string): Promise<WikiSummaryResponse | null> {
  try {
    const url = `${WIKI_REST}/${encodeWikiTitle(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as WikiSummaryResponse;
    if (data.type === 'disambiguation') return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchExtract(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      titles: title,
      format: 'json',
      redirects: '1',
    });
    const res = await fetch(`${WIKI_API}?${params}`, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || !page.extract || page.extract.trim().length < 50) return null;
    return page.extract.trim();
  } catch {
    return null;
  }
}

async function main() {
  const outDir = join(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'famous-places-raw.json');

  console.log(`Starting Wikipedia crawl for ${FAMOUS.length} famous places...`);

  const results: FamousPlace[] = [];
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < FAMOUS.length; i++) {
    const f = FAMOUS[i];
    process.stdout.write(`[${i + 1}/${FAMOUS.length}] ${f.name}... `);

    const summary = await fetchSummary(f.wikiTitle);
    await sleep(RATE_LIMIT_MS);

    if (!summary?.extract || summary.extract.length < 50) {
      notFound++;
      process.stdout.write('✗\n');
      continue;
    }

    const content = await fetchExtract(f.wikiTitle) ?? summary.extract;
    await sleep(RATE_LIMIT_MS);

    const coverUrl = summary.originalimage?.source ?? summary.thumbnail?.source ?? null;

    results.push({
      name: f.name,
      province: f.province,
      type: f.type,
      lat: f.lat,
      lng: f.lng,
      wikiTitle: summary.title ?? f.wikiTitle,
      summary: summary.extract.slice(0, 500),
      content,
      coverUrl,
      sourceUrl: summary.content_urls?.desktop?.page ?? `https://vi.wikipedia.org/wiki/${encodeWikiTitle(f.wikiTitle)}`,
    });
    found++;
    process.stdout.write('✓\n');
  }

  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');

  const coverage = ((found / FAMOUS.length) * 100).toFixed(1);
  console.log(`\nDone. ${found}/${FAMOUS.length} found (${coverage}% coverage)`);
  console.log(`Output: ${outPath}`);
}

main().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});