import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { Transaction } from '@mysten/sui/transactions'
import type { GameItem, ItemRarity, ItemType, MarketplaceListing } from '../types/game'

const SUI_RPC = 'https://fullnode.testnet.sui.io:443'
export const ITEM_PACKAGE_ID = import.meta.env.VITE_SUI_ITEM_PACKAGE_ID || '0x0000000000000000000000000000000000000000000000000000000000000000'
const SUI_CLOCK_OBJECT_ID = '0x6'
const ITEM_STRUCT = `${ITEM_PACKAGE_ID}::inventory::Item`
const INVENTORY_STRUCT = `${ITEM_PACKAGE_ID}::inventory::Inventory`
const LISTING_STRUCT = `${ITEM_PACKAGE_ID}::inventory::Listing`
const provider = new SuiJsonRpcClient({ network: 'testnet', url: SUI_RPC })

type OwnedObjectRef = {
  objectId?: string
  data?: {
    objectId?: string
  }
}

export async function fetchInventory(owner: string): Promise<GameItem[]> {
  const result = await provider.getOwnedObjects({
    owner,
    filter: { StructType: ITEM_STRUCT },
    options: { showType: true, showContent: true },
  })

  return Promise.all(
    result.data.map(async (object: unknown) => {
      const objectRef = object as OwnedObjectRef
      const objectId = extractOwnedObjectId(objectRef)
      if (!objectId) {
        throw new Error('Cannot read item objectId from getOwnedObjects response.')
      }
      const detail = await provider.getObject({
        id: objectId,
        options: { showContent: true, showDisplay: true },
      })

      const fields =
        detail.data?.content?.dataType === 'moveObject'
          ? (detail.data.content.fields as Record<string, unknown>)
          : undefined

      return {
        id: objectId,
        name: parseMoveString(fields?.name) ?? 'Unknown item',
        itemType: asItemType(parseMoveString(fields?.item_type)),
        rarity: parseRarity(fields?.rarity),
        level: Number(fields?.level ?? 1),
        durability: Number(fields?.durability ?? 0),
        maxDurability: Number(fields?.max_durability ?? 0),
        owner,
        createdAt: Number(fields?.created_at ?? 0),
      }
    }),
  )
}

export async function fetchMarketplaceListings(owner: string): Promise<MarketplaceListing[]> {
  const result = await provider.getOwnedObjects({
    owner,
    filter: { StructType: LISTING_STRUCT },
    options: { showType: true, showContent: true },
  })

  const listings = await Promise.all(
    result.data.map(async (object: unknown) => {
      const objectRef = object as OwnedObjectRef
      const objectId = extractOwnedObjectId(objectRef)
      if (!objectId) {
        throw new Error('Cannot read listing objectId from getOwnedObjects response.')
      }
      const detail = await provider.getObject({
        id: objectId,
        options: { showContent: true },
      })

      const fields =
        detail.data?.content?.dataType === 'moveObject'
          ? (detail.data.content.fields as Record<string, unknown>)
          : undefined

      const itemField = fields?.item as Record<string, unknown> | undefined
      const itemData = parseListingItem(itemField, owner)
      return {
        id: objectId,
        seller: parseAddressLike(fields?.seller) ?? owner,
        price: Number(fields?.price ?? 0),
        active: Boolean(fields?.active),
        item: itemData,
        createdAt: Number(fields?.created_at ?? 0),
      }
    }),
  )

  return listings.filter((listing: MarketplaceListing) => listing.active)
}

export async function fetchInventoryObjectId(owner: string): Promise<string | null> {
  const result = await provider.getOwnedObjects({
    owner,
    filter: { StructType: INVENTORY_STRUCT },
    options: { showType: true },
  })
  if (result.data.length === 0) return null
  return extractOwnedObjectId(result.data[0] as OwnedObjectRef) ?? null
}

export async function fetchAllMarketplaceListings(): Promise<MarketplaceListing[]> {
  const listingIds = await fetchListingIdsFromEvents()

  const listings = await Promise.all(
    listingIds.map(async (listingId) => {
      const detail = await provider.getObject({
        id: listingId,
        options: { showContent: true },
      })
      const fields =
        detail.data?.content?.dataType === 'moveObject'
          ? (detail.data.content.fields as Record<string, unknown>)
          : undefined
      const seller = parseAddressLike(fields?.seller) ?? ''
      const itemField = fields?.item as Record<string, unknown> | undefined
      return {
        id: String(listingId),
        seller,
        price: Number(fields?.price ?? 0),
        active: Boolean(fields?.active),
        item: parseListingItem(itemField, seller),
        createdAt: Number(fields?.created_at ?? 0),
      }
    }),
  )

  return listings.filter((listing: MarketplaceListing) => listing.active)
}

function parseMoveString(value: unknown): string | null {
  if (typeof value === 'string') return value

  if (value && typeof value === 'object') {
    const candidate = value as { bytes?: string | number[]; fields?: Record<string, unknown> }
    if (typeof candidate.bytes === 'string') {
      try {
        return new TextDecoder().decode(Uint8Array.from(candidate.bytes.match(/.{1,2}/g)?.map((hex) => parseInt(hex, 16)) ?? []))
      } catch {
        return null
      }
    }
    if (Array.isArray(candidate.bytes)) {
      try {
        return new TextDecoder().decode(Uint8Array.from(candidate.bytes))
      } catch {
        return null
      }
    }

    // Handle Move string wrappers: { fields: { bytes: ... } }
    const fieldsBytes = candidate.fields?.bytes
    if (typeof fieldsBytes === 'string') {
      try {
        return new TextDecoder().decode(Uint8Array.from(fieldsBytes.match(/.{1,2}/g)?.map((hex) => parseInt(hex, 16)) ?? []))
      } catch {
        return null
      }
    }
    if (Array.isArray(fieldsBytes)) {
      try {
        return new TextDecoder().decode(Uint8Array.from(fieldsBytes as number[]))
      } catch {
        return null
      }
    }
  }

  return null
}

function asItemType(value: string | null): ItemType {
  if (!value) return 'Sword'
  const normalized = value.trim()
  if (normalized === 'Sword' || normalized === 'Armor' || normalized === 'Potion' || normalized === 'Shield' || normalized === 'Accessory') {
    return normalized
  }
  return 'Sword'
}

function parseRarity(value: unknown): ItemRarity {
  if (typeof value === 'string') {
    if (value === 'Common' || value === 'Rare' || value === 'Epic' || value === 'Legendary') return value
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    for (const key of keys) {
      if (key === 'Common' || key === 'Rare' || key === 'Epic' || key === 'Legendary') return key
    }
  }

  return 'Common'
}

export function buildMintItemTransaction(itemType: ItemType, rarity: ItemRarity) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::mint_item`,
    typeArguments: [],
    arguments: [tx.pure.string(itemType), tx.pure.string(itemType), tx.pure.u8(rarityToIndex(rarity)), tx.object(SUI_CLOCK_OBJECT_ID)],
  })
  return tx
}

export function buildCreateInventoryTransaction() {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::create_inventory`,
    typeArguments: [],
    arguments: [tx.object(SUI_CLOCK_OBJECT_ID)],
  })
  return tx
}

export function buildFarmRandomItemTransaction(itemType: ItemType, inventoryId: string) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::farm_random_item`,
    typeArguments: [],
    arguments: [tx.object(inventoryId), tx.pure.string(itemType), tx.pure.string(itemType), tx.object(SUI_CLOCK_OBJECT_ID)],
  })
  return tx
}

export function buildUseItemTransaction(itemId: string) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::use_item`,
    typeArguments: [],
    arguments: [tx.object(itemId)],
  })
  return tx
}

export function buildUpgradeItemTransaction(itemId: string) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::upgrade_item`,
    typeArguments: [],
    arguments: [tx.object(itemId)],
  })
  return tx
}

export function buildTransferItemTransaction(itemId: string, recipient: string) {
  const tx = new Transaction()
  tx.transferObjects([tx.object(itemId)], tx.pure.address(recipient))
  return tx
}

export function buildListItemTransaction(itemId: string, priceMist: number) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::list_item`,
    typeArguments: [],
    arguments: [tx.object(itemId), tx.pure.u64(priceMist), tx.object(SUI_CLOCK_OBJECT_ID)],
  })
  return tx
}

export function buildBuyItemTransaction(listingId: string, priceMist: number) {
  const tx = new Transaction()
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)])
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::buy_item`,
    typeArguments: [],
    arguments: [tx.object(listingId), payment],
  })
  return tx
}

export function buildCancelListingTransaction(listingId: string) {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ITEM_PACKAGE_ID}::inventory::cancel_listing`,
    typeArguments: [],
    arguments: [tx.object(listingId)],
  })
  return tx
}

function rarityToIndex(rarity: ItemRarity): number {
  switch (rarity) {
    case 'Common':
      return 0
    case 'Rare':
      return 1
    case 'Epic':
      return 2
    case 'Legendary':
      return 3
    default:
      return 0
  }
}

function parseListingItem(itemOption: Record<string, unknown> | undefined, owner: string): GameItem | null {
  if (!itemOption) return null
  const vec = extractOptionVec(itemOption)
  const rawItem = Array.isArray(vec) && vec.length > 0
    ? (vec[0] as Record<string, unknown>)
    : itemOption
  const item = unwrapMoveFields(rawItem)
  const itemId = parseObjectIdField(item.id)

  const parsedName = parseMoveString(item.name) ?? 'Listed item'
  const parsedType = asItemType(parseMoveString(item.item_type))

  return {
    id: itemId ?? '',
    name: parsedName,
    itemType: parsedType,
    rarity: parseRarity(item.rarity),
    level: Number(item.level ?? 1),
    durability: Number(item.durability ?? 0),
    maxDurability: Number(item.max_durability ?? 0),
    owner,
    createdAt: Number(item.created_at ?? 0),
  }
}

function extractOwnedObjectId(object: OwnedObjectRef): string | null {
  if (typeof object.objectId === 'string') return object.objectId
  if (object.data && typeof object.data.objectId === 'string') return object.data.objectId
  return null
}

function parseObjectIdField(value: unknown): string | null {
  return parseAddressLike(value)
}

async function fetchListingIdsFromEvents(): Promise<string[]> {
  const listingIds = new Set<string>()
  let cursor: unknown = null
  let hasNextPage = true
  let scannedPages = 0

  while (hasNextPage && scannedPages < 5) {
    const eventPage = await provider.queryEvents({
      query: {
        MoveEventType: `${ITEM_PACKAGE_ID}::inventory::ItemListed`,
      },
      limit: 100,
      order: 'descending',
      cursor: cursor as Parameters<typeof provider.queryEvents>[0]['cursor'],
    })

    for (const evt of eventPage.data) {
      const event = evt as { parsedJson?: Record<string, unknown> }
      const parsed = event.parsedJson as Record<string, unknown> | undefined
      const listingId = parseAddressLike(parsed?.listing_id)
      if (listingId) {
        listingIds.add(listingId)
      }
    }

    cursor = eventPage.nextCursor
    hasNextPage = eventPage.hasNextPage
    scannedPages += 1
  }

  return Array.from(listingIds)
}

function parseAddressLike(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  if (typeof record.objectId === 'string') return record.objectId
  if (typeof record.bytes === 'string') return record.bytes

  if (record.id && typeof record.id === 'object') {
    const nestedId = record.id as Record<string, unknown>
    if (typeof nestedId.id === 'string') return nestedId.id
    if (typeof nestedId.bytes === 'string') return nestedId.bytes
  }

  if (record.fields && typeof record.fields === 'object') {
    const fields = record.fields as Record<string, unknown>
    if (typeof fields.id === 'string') return fields.id
  }

  return null
}

function extractOptionVec(value: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(value.vec)) return value.vec as unknown[]
  if (value.fields && typeof value.fields === 'object') {
    const fields = value.fields as Record<string, unknown>
    if (Array.isArray(fields.vec)) return fields.vec as unknown[]
    if (fields.some && typeof fields.some === 'object') {
      const some = fields.some as Record<string, unknown>
      if (Array.isArray(some.vec)) return some.vec as unknown[]
      return [some]
    }
  }

  if (Array.isArray(value.value)) return value.value as unknown[]

  if (value.some && typeof value.some === 'object') {
    const some = value.some as Record<string, unknown>
    if (Array.isArray(some.vec)) return some.vec as unknown[]
    return [some]
  }

  return null
}

function unwrapMoveFields(value: Record<string, unknown>): Record<string, unknown> {
  if (value.fields && typeof value.fields === 'object') {
    return value.fields as Record<string, unknown>
  }
  return value
}
