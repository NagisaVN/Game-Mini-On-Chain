# Game Mini On-chain

Object-centric inventory game demo on Sui.  
Each item is an independent on-chain object with ownership and mutable state (`level`, `rarity`, `durability`).

## MVP Loop

- Connect wallet
- Farm (mint) item on-chain
- Use item (durability decreases)
- Upgrade item (level up + durability refill)
- Transfer item to another wallet
- Farm random loot (weighted rarity)
- List and buy items on on-chain marketplace

This is intentionally small to demonstrate:
- On-chain state
- True ownership transfer
- Stateful game logic (not metadata-only NFT)

## Tech Stack

- Frontend: React + Vite + Tailwind
- State: Zustand
- Chain SDK: `@mysten/sui.js`
- Smart contract: Move (`move/ItemInventory.move`)

## Prerequisites

- Node.js 18+
- pnpm
- Sui wallet browser extension (Testnet)
- SUI token on Testnet for gas
- Sui CLI (to publish Move package)

## 1) Publish Move Module

File contract: `move/ItemInventory.move`.

Use Sui CLI to publish and copy the generated package id:

```bash
sui client publish --gas-budget 100000000
```

After publish, note the package id from command output.

## 2) Configure Environment

Create `.env` in project root:

```env
VITE_SUI_ITEM_PACKAGE_ID=0xYOUR_PACKAGE_ID
```

## 3) Install and Run

```bash
pnpm install
pnpm dev
```

Open the local Vite URL, connect wallet, and start farming items.

## Demo Scenario (2 wallets)

1. Wallet A connects and farms 1-2 items.
2. Wallet A uses/upgrades one item and refreshes inventory.
3. Wallet A transfers selected item to Wallet B address.
4. Wallet B connects and refreshes inventory to verify ownership moved.

## Slush Wallet Connection

- Install **Slush Wallet** extension.
- Switch network to **Testnet**.
- Open app and click `Connect` (from dApp Kit button).
- Approve the connection request in Slush.

If connect fails, refresh page and reconnect wallet on Testnet.

## Random Loot Demo (Phase 2A)

1. Choose an item type.
2. Click `Farm random loot`.
3. App calls `farm_random_item` and emits loot-roll event.
4. Refresh inventory to view generated rarity.

Current rarity weights:
- Common: 60%
- Rare: 25%
- Epic: 12%
- Legendary: 3%

## Marketplace Demo (Phase 2B)

1. Select an inventory item.
2. Enter listing price (mist) and click `List selected item`.
3. Listing appears in marketplace board.
4. Another wallet clicks `Buy` to purchase.
5. Seller can click `Cancel` before item is sold.

## Notes

- RPC endpoint defaults to Sui Testnet in `src/lib/suiClient.ts`.
- `mint_item` and `farm_random_item` require `Clock` object (`0x6`).
- Marketplace listing is object-based with escrowed item in listing object.
- If fetch shows empty list, verify:
  - wallet is on Testnet
  - package id in `.env` is correct
  - connected wallet owns item objects
