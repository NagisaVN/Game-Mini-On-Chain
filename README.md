# Game Mini On Chain 🎮

Một trò chơi blockchain mini được xây dựng trên **Sui Network**, kết hợp thế giới trò chơi 2D với các tính năng Web3. Mỗi vật phẩm là một đối tượng độc lập trên chuỗi với quyền sở hữu thực và trạng thái có thể thay đổi (`level`, `rarity`, `durability`).

## Tính Năng Chính ✨

- **Trò Chơi 2D Interactif**: Sử dụng Phaser 4 cho gameplay đầy đủ
- **Hệ Thống Vật Phẩm NFT**: Các vật phẩm được lưu trữ trên blockchain Sui với quyền sở hữu thực
- **Sàn Giao Dịch**: Marketplace để mua, bán vật phẩm trên chuỗi
- **Hệ Thống Độ Bền**: Vật phẩm có độ bền giảm khi sử dụng
- **Nâng Cấp Vật Phẩm**: Tăng cấp độ và phục hồi độ bền
- **Tạo Loot Ngẫu Nhiên**: Tạo vật phẩm với độ hiếm theo trọng số
- **Chuyển Giao Quyền Sở Hữu**: Chuyển vật phẩm đến ví khác

## Quy Trình MVP

1. ✅ Kết nối ví Sui
2. ✅ Farm (tạo) vật phẩm trên chuỗi
3. ✅ Sử dụng vật phẩm (độ bền giảm)
4. ✅ Nâng cấp vật phẩm (tăng level + phục hồi độ bền)
5. ✅ Chuyển vật phẩm sang ví khác
6. ✅ Tạo loot ngẫu nhiên (weighted rarity)
7. ✅ Niêm yết và mua vật phẩm trên marketplace

## Công Nghệ Sử Dụng 🛠️

### Frontend
- **React 19** - Thư viện UI hiện đại
- **TypeScript** - Type-safe development
- **Vite** - Build tool hiệu năng cao
- **Tailwind CSS** - Styling utility-first
- **Phaser 4** - Game engine 2D
- **Zustand** - State management
- **TanStack Query** - Data fetching

### Blockchain
- **Sui Network** - Layer 1 blockchain
- **Move Language** - Smart contracts
- **@mysten/sui.js** - Sui SDK
- **@mysten/dapp-kit** - Web3 integration kit

## Yêu Cầu 📦

- Node.js >= 18.0.0
- pnpm (khuyến nghị)
- Sui Wallet Browser Extension
- SUI token trên Testnet để trả phí gas
- Sui CLI (để deploy Move package)

## Hướng Dẫn Thiết Lập 🚀

### 1) Publish Move Module

File hợp đồng: `move/ItemInventory.move`

Sử dụng Sui CLI để publish:

```bash
sui client publish --gas-budget 100000000
```

Sau khi publish, sao chép Package ID từ output.

### 2) Cấu Hình Environment

Tạo file `.env` trong thư mục gốc:

```env
VITE_SUI_ITEM_PACKAGE_ID=0xYOUR_PACKAGE_ID
```

### 3) Cài Đặt và Chạy

```bash
pnpm install
pnpm dev
```

Mở Vite URL cục bộ, kết nối ví, và bắt đầu tạo vật phẩm.

## Cấu Trúc Thư Mục 📁

```
Game-Mini-On-Chain/
├── src/
│   ├── components/          # React components
│   │   └── PhaserGame.tsx   # Game component chính
│   ├── game/                # Game logic
│   │   ├── scenes/          # Phaser scenes
│   │   │   ├── BootScene.js
│   │   │   └── BattleScene.js
│   │   └── objects/         # Game objects
│   │       ├── Player.js
│   │       └── Enemy.js
│   ├── lib/
│   │   └── suiClient.ts     # Sui blockchain connection
│   ├── store/               # Zustand stores
│   │   └── useGameStore.ts  # Game state management
│   ├── types/               # TypeScript types
│   │   ├── game.ts
│   │   └── sui.d.ts
│   └── main.tsx
├── move/                    # Move smart contracts
│   ├── sources/
│   │   └── ItemInventory.move
│   ├── Move.toml
│   └── build/               # Build output
├── public/                  # Static assets
└── package.json
```

## Hướng Dẫn Sử Dụng 📖

### Demo với 2 Ví

1. **Ví A** kết nối và tạo 1-2 vật phẩm
2. **Ví A** sử dụng/nâng cấp một vật phẩm
3. **Ví A** chuyển vật phẩm được chọn sang địa chỉ Ví B
4. **Ví B** kết nối và kiểm tra kho để xác nhận quyền sở hữu đã chuyển

### Kết Nối Ví Sui

- Cài đặt extension **Sui Wallet**
- Chuyển network sang **Testnet**
- Mở ứng dụng và click nút `Connect`
- Chấp nhận yêu cầu kết nối

Nếu kết nối thất bại, làm mới trang và kết nối lại ví trên Testnet.

### Tạo Loot Ngẫu Nhiên (Phase 2A)

1. Chọn loại vật phẩm
2. Click `Farm random loot`
3. Ứng dụng gọi `farm_random_item` và phát event loot-roll
4. Làm mới kho để xem độ hiếm được tạo

**Trọng số độ hiếm:**
- Common (Thường): 60%
- Rare (Hiếm): 25%
- Epic: 12%
- Legendary (Huyền Thoại): 3%

### Marketplace Demo (Phase 2B)

1. Chọn một vật phẩm từ kho
2. Nhập giá niêm yết (mist) và click `List selected item`
3. Niêm yết xuất hiện trên bảng marketplace
4. Ví khác click `Buy` để mua hàng
5. Người bán có thể click `Cancel` trước khi vật phẩm được bán

## Các Loại Vật Phẩm 🗡️

| Loại | Mô Tả |
|------|-------|
| **Sword** | Vũ khí tấn công, tăng sát thương |
| **Armor** | Giáp phòng thủ, giảm sát thương nhận |
| **Potion** | Dùi hỗ trợ, phục hồi sức khỏe |
| **Shield** | Khiên, tăng phòng thủ |
| **Accessory** | Phụ kiện, tăng chỉ số khác |

## Độ Hiếm Vật Phẩm 💎

- **Common** - Dễ tìm, chỉ số cơ bản
- **Rare** - Khó tìm hơn, chỉ số tốt hơn
- **Epic** - Rất hiếm, chỉ số cao
- **Legendary** - Cực kỳ hiếm, chỉ số cao nhất

## Các Lệnh Phát Triển 👨‍💻

```bash
# Khởi động máy chủ phát triển
pnpm dev

# Build cho production
pnpm build

# Kiểm tra lint
pnpm lint

# Preview build
pnpm preview
```

## Troubleshooting 🔧

### Lỗi Kết Nối Ví
- Đảm bảo Sui Wallet extension được cài đặt
- Kiểm tra network được chọn là Testnet
- Clear cache trình duyệt và thử lại

### Lỗi Build
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

### Lỗi Phaser Game
- Kiểm tra console để xem chi tiết lỗi
- Đảm bảo assets được tải từ thư mục `public/`
- Restart dev server

## Tài Nguyên 📚

- [Sui Documentation](https://docs.sui.io/)
- [Move Language Docs](https://move-language.github.io/)
- [Phaser 4 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

## Giấy Phép 📄

Dự án này được cấp phép dưới MIT License.

---

**Game Mini On Chain** - Kết hợp Gaming và Blockchain 🚀

## Notes

- RPC endpoint defaults to Sui Testnet in `src/lib/suiClient.ts`.
- `mint_item` and `farm_random_item` require `Clock` object (`0x6`).
- Marketplace listing is object-based with escrowed item in listing object.
- If fetch shows empty list, verify:
  - wallet is on Testnet
  - package id in `.env` is correct
  - connected wallet owns item objects
