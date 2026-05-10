export const ITEM_TYPES = ['Sword', 'Armor', 'Potion', 'Shield', 'Accessory'] as const
export const ITEM_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'] as const

export type ItemType = (typeof ITEM_TYPES)[number]
export type ItemRarity = (typeof ITEM_RARITIES)[number]

export interface GameItem {
  id: string
  name: string
  itemType: ItemType
  rarity: ItemRarity
  level: number
  durability: number
  maxDurability: number
  owner: string
  createdAt?: number
}

export interface MarketplaceListing {
  id: string
  seller: string
  price: number
  active: boolean
  item: GameItem | null
  createdAt?: number
}
