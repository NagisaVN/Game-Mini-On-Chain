import { ConnectButton, useCurrentAccount, useDisconnectWallet, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildBuyItemTransaction,
  buildCancelListingTransaction,
  buildCreateInventoryTransaction,
  buildFarmRandomItemTransaction,
  buildListItemTransaction,
  buildMintItemTransaction,
  buildTransferItemTransaction,
  buildUpgradeItemTransaction,
  buildUseItemTransaction,
  fetchAllMarketplaceListings,
  fetchMarketplaceListings,
  fetchInventory,
  fetchInventoryObjectId,
} from './lib/suiClient'
import { useGameStore } from './store/useGameStore'
import { ITEM_RARITIES, ITEM_TYPES, type GameItem, type ItemRarity, type ItemType, type MarketplaceListing } from './types/game'
import PhaserGame from './components/PhaserGame'

function App() {
  const address = useGameStore((state) => state.address)
  const inventory = useGameStore((state) => state.inventory)
  const loading = useGameStore((state) => state.loading)
  const status = useGameStore((state) => state.status)
  const setAddress = useGameStore((state) => state.setAddress)
  const setInventory = useGameStore((state) => state.setInventory)
  const setLoading = useGameStore((state) => state.setLoading)
  const setStatus = useGameStore((state) => state.setStatus)

  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: disconnectWallet } = useDisconnectWallet()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState('')
  const [listingPrice, setListingPrice] = useState('10000000')
  const [farmType, setFarmType] = useState<ItemType>('Sword')
  const [farmRarity, setFarmRarity] = useState<ItemRarity>('Common')
  const [marketplace, setMarketplace] = useState<MarketplaceListing[]>([])
  const [inventoryObjectId, setInventoryObjectId] = useState<string | null>(null)
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null)

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedItemId) ?? null,
    [inventory, selectedItemId],
  )

  const refreshInventory = useCallback(async (owner: string) => {
    try {
      setLoading(true)
      setStatus('Loading inventory…')
      const inventoryId = await fetchInventoryObjectId(owner)
      setInventoryObjectId(inventoryId)
      const items = await fetchInventory(owner)
      setInventory(items)
      setStatus(`Inventory loaded (${items.length} items)`)
    } catch (error) {
      setStatus('Failed to load inventory. Confirm Sui wallet and package config.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [setInventory, setLoading, setStatus])

  const refreshMarketplace = useCallback(async () => {
    try {
      const [publicListings, ownedListings] = await Promise.all([
        fetchAllMarketplaceListings(),
        account?.address ? fetchMarketplaceListings(account.address) : Promise.resolve([]),
      ])

      const byId = new Map<string, MarketplaceListing>()
      for (const listing of [...publicListings, ...ownedListings]) {
        if (!listing.active) continue
        byId.set(listing.id, listing)
      }

      setMarketplace(Array.from(byId.values()))
    } catch (error) {
      console.error('Failed to refresh marketplace:', error)
      setMarketplace([])
    }
  }, [account?.address])

  useEffect(() => {
    if (account?.address) {
      setAddress(account.address)
      const timeoutId = window.setTimeout(() => {
        void refreshInventory(account.address)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    } else {
      setAddress('')
      setInventory([])
    }
  }, [account?.address, refreshInventory, setAddress, setInventory])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshMarketplace()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [account?.address, refreshMarketplace])

  const runTransaction = async (label: string, tx: Parameters<typeof signAndExecuteTransaction>[0]['transaction']) => {
    setLoading(true)
    setStatus(label)
    try {
      const result = await signAndExecuteTransaction({ transaction: tx })
      if (result.digest) {
        const txUrl = buildSuiScanTxUrl(result.digest)
        setLastTxUrl(txUrl)
        window.open(txUrl, '_blank', 'noopener,noreferrer')
        await suiClient.waitForTransaction({ digest: result.digest })
      }
      if (account?.address) {
        await refreshInventory(account.address)
      }
      await refreshMarketplace()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Transaction failed: ${message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    await disconnectWallet()
    setAddress('')
    setInventory([])
    setMarketplace([])
    setInventoryObjectId(null)
    setSelectedItemId(null)
    setStatus('Wallet disconnected')
  }

  const handleFarm = async () => {
    if (!address) {
      setStatus('Connect wallet first to mint items.')
      return
    }
    try {
      setLoading(true)
      await runTransaction('Minting item on-chain…', buildMintItemTransaction(farmType, farmRarity))
      setStatus('Item minted successfully.')
    } catch (error) {
      setStatus('Mint failed. Confirm the module is deployed and wallet is connected.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUseItem = async () => {
    if (!address || !selectedItem) return
    try {
      setLoading(true)
      setStatus(`Using ${selectedItem.name}…`)
      await runTransaction(`Using ${selectedItem.name}…`, buildUseItemTransaction(selectedItem.id))
      setStatus(`${selectedItem.name} used on-chain.`)
    } catch (error) {
      setStatus('Action failed. Confirm the item is on-chain and connected.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgradeItem = async () => {
    if (!address || !selectedItem) return
    try {
      setLoading(true)
      setStatus(`Upgrading ${selectedItem.name}…`)
      await runTransaction(`Upgrading ${selectedItem.name}…`, buildUpgradeItemTransaction(selectedItem.id))
      setStatus(`${selectedItem.name} upgraded on-chain.`)
    } catch (error) {
      setStatus('Upgrade failed. Confirm the item is on-chain and connected.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleTransferItem = async () => {
    if (!address || !selectedItem) return
    if (!transferTarget) {
      setStatus('Enter a valid Sui address to transfer.')
      return
    }
    try {
      setLoading(true)
      setStatus(`Transferring ${selectedItem.name}…`)
      await runTransaction(`Transferring ${selectedItem.name}…`, buildTransferItemTransaction(selectedItem.id, transferTarget))
      setTransferTarget('')
      setSelectedItemId(null)
      setStatus(`${selectedItem.name} transferred.`)
    } catch (error) {
      setStatus('Transfer failed. Confirm address and network.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleRandomFarm = async () => {
    if (!address) {
      setStatus('Connect wallet first.')
      return
    }
    if (!inventoryObjectId) {
      setStatus('Create inventory first, then farm random loot.')
      return
    }
    try {
      await runTransaction('Rolling random loot on-chain…', buildFarmRandomItemTransaction(farmType, inventoryObjectId))
      setStatus('Random loot minted successfully.')
    } catch (error) {
      setStatus('Random farm failed.')
      console.error(error)
    }
  }

  const handleCreateInventory = async () => {
    if (!address) {
      setStatus('Connect wallet first.')
      return
    }
    if (inventoryObjectId) {
      setStatus('Inventory already initialized.')
      return
    }
    try {
      await runTransaction('Creating inventory on-chain…', buildCreateInventoryTransaction())
      setStatus('Inventory created successfully.')
    } catch (error) {
      setStatus('Create inventory failed.')
      console.error(error)
    }
  }

  const handleListItem = async () => {
    if (!selectedItem) return
    const mist = Number(listingPrice)
    if (!Number.isFinite(mist) || mist <= 0) {
      setStatus('Listing price must be a positive number (mist).')
      return
    }
    try {
      await runTransaction(`Listing ${selectedItem.name}…`, buildListItemTransaction(selectedItem.id, mist))
      setSelectedItemId(null)
      setStatus(`${selectedItem.name} listed on marketplace.`)
    } catch (error) {
      setStatus('Listing failed.')
      console.error(error)
    }
  }

  const handleBuyListing = async (listing: MarketplaceListing) => {
    try {
      const itemLabel = listing.item?.name ?? 'item'
      await runTransaction(`Buying ${itemLabel}…`, buildBuyItemTransaction(listing.id, listing.price))
      setStatus(`${itemLabel} purchased.`)
    } catch (error) {
      setStatus('Buy failed.')
      console.error(error)
    }
  }

  const handleCancelListing = async (listing: MarketplaceListing) => {
    try {
      await runTransaction('Cancelling listing…', buildCancelListingTransaction(listing.id))
      setStatus('Listing cancelled.')
    } catch (error) {
      setStatus('Cancel failed.')
      console.error(error)
    }
  }

  const getBattleModifiers = useCallback(() => {
    if (!selectedItem) {
      return { attackBonus: 0, defenseBonus: 0, itemLabel: 'No item selected' }
    }

    const rarityBonus = rarityToBonus(selectedItem.rarity)
    const levelBonus = Math.floor(selectedItem.level / 2)
    const bonusValue = rarityBonus + levelBonus

    if (selectedItem.itemType === 'Sword') {
      return {
        attackBonus: bonusValue,
        defenseBonus: 0,
        itemLabel: `${selectedItem.name} (Sword)`,
      }
    }

    if (selectedItem.itemType === 'Armor' || selectedItem.itemType === 'Shield') {
      return {
        attackBonus: 0,
        defenseBonus: bonusValue,
        itemLabel: `${selectedItem.name} (${selectedItem.itemType})`,
      }
    }

    return {
      attackBonus: 0,
      defenseBonus: 0,
      itemLabel: `${selectedItem.name} (no battle bonus)`,
    }
  }, [selectedItem])

  const handleBattleAttack = useCallback(() => {
    if (!selectedItem) {
      return { canProceed: false, message: 'Pick an inventory item first.' }
    }
    if (selectedItem.durability <= 0) {
      return { canProceed: false, message: `${selectedItem.name} has 0 durability.` }
    }

    console.log(`[sui-stub] battle attack using ${selectedItem.name}`)
    return { canProceed: true }
  }, [selectedItem])

  const handleBattleVictory = useCallback(async () => {
    if (!address) {
      setStatus('Victory! Connect wallet to mint reward.')
      return
    }
    if (!selectedItem) {
      setStatus('Victory! Select an item first so durability can be consumed.')
      return
    }
    if (selectedItem.durability <= 0) {
      setStatus('Victory but selected item has 0 durability.')
      return
    }

    try {
      await runTransaction(`Using ${selectedItem.name} durability…`, buildUseItemTransaction(selectedItem.id))
      await runTransaction('Minting victory reward item…', buildMintItemTransaction('Accessory', 'Rare'))
      setStatus(`Victory! ${selectedItem.name} durability consumed and reward item minted (sellable on marketplace).`)
    } catch (error) {
      setStatus('Victory achieved, but reward/durability transaction failed.')
      console.error(error)
    }
  }, [address, runTransaction, selectedItem, setStatus])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-400/80">Sui Game Demo</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                On-chain Inventory & Item Logic
              </h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Object-centric items, ownership, and stateful game actions on Sui.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {address ? (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
                    Connected: <span className="font-semibold text-slate-100">{address}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <ConnectButton className="rounded-2xl !bg-sky-500 !px-5 !py-3 !text-sm !font-semibold !text-slate-950 transition hover:!bg-sky-400" />
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Farm & mint items</h2>
                <p className="mt-1 text-slate-400">
                  Mint an on-chain object item and show ownership directly in your wallet.
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
                Testnet-ready
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                Item type
                <select
                  value={farmType}
                  onChange={(event) => setFarmType(event.target.value as ItemType)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                >
                  {ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                Rarity
                <select
                  value={farmRarity}
                  onChange={(event) => setFarmRarity(event.target.value as ItemRarity)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                >
                  {ITEM_RARITIES.map((rarity) => (
                    <option key={rarity} value={rarity}>{rarity}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCreateInventory}
                disabled={loading || !!inventoryObjectId}
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {inventoryObjectId ? 'Inventory initialized' : 'Create inventory'}
              </button>
              <button
                type="button"
                onClick={handleFarm}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mint (manual rarity)
              </button>
              <button
                type="button"
                onClick={handleRandomFarm}
                disabled={loading || !inventoryObjectId}
                className="inline-flex items-center justify-center rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Farm random loot
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/20">
            <h2 className="text-2xl font-semibold text-white">Game actions</h2>
            <p className="mt-2 text-slate-400">
              Select an item to use durability, upgrade level, or send it to another player.
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-300">Selected item</p>
                <div className="mt-3 min-h-[96px] rounded-3xl bg-slate-900 px-4 py-5 text-slate-200">
                  {selectedItem ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-white">{selectedItem.name}</p>
                      <p className="text-sm text-slate-400">
                        {selectedItem.itemType} · {selectedItem.rarity} · Lv. {selectedItem.level}
                      </p>
                      <p className="text-sm text-slate-400">Durability {selectedItem.durability}/{selectedItem.maxDurability}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Pick an item from your inventory panel.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleUseItem}
                  disabled={!selectedItem || loading}
                  className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use item
                </button>
                <button
                  type="button"
                  onClick={handleUpgradeItem}
                  disabled={!selectedItem || loading}
                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Upgrade item
                </button>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <label className="text-sm text-slate-300">Transfer to address</label>
                <input
                  value={transferTarget}
                  onChange={(event) => setTransferTarget(event.target.value)}
                  placeholder="0x..."
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleTransferItem}
                  disabled={!selectedItem || loading}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Transfer selected item
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/20">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-white">Battle Arena</h2>
            <p className="text-slate-400">
              Battle uses selected inventory item: <span className="text-sky-300">Sword = attack bonus</span>,{' '}
              <span className="text-emerald-300">Armor/Shield = defend bonus</span>. Win battle to mint a reward item you can list in Marketplace.
            </p>
          </div>
          <div className="mt-5">
            <PhaserGame
              onPlayerAttack={handleBattleAttack}
              onBattleVictory={handleBattleVictory}
              getBattleModifiers={getBattleModifiers}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Inventory</h2>
              <p className="mt-1 text-slate-400">Each item is an independent on-chain object with state.</p>
            </div>
            <button
              type="button"
              onClick={() => address && refreshInventory(address)}
              className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              Refresh inventory
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inventory.length > 0 ? (
              inventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`group flex flex-col gap-4 rounded-3xl border p-5 text-left transition ${
                    selectedItemId === item.id
                      ? 'border-sky-400 bg-slate-900'
                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-slate-400">
                        {item.itemType} · {item.rarity}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      Lv {item.level}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Durability</span>
                      <span>{item.durability}/{item.maxDurability}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 px-6 py-14 text-center text-slate-400">
                {address ? (
                  <p>You have no on-chain items yet. Farm one to start your inventory.</p>
                ) : (
                  <p>Connect a Sui wallet to show your on-chain item inventory.</p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Marketplace</h2>
              <p className="mt-1 text-slate-400">Fixed-price on-chain listing and buy flow.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={listingPrice}
                onChange={(event) => setListingPrice(event.target.value)}
                placeholder="Price in mist"
                disabled={!address}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={handleListItem}
                disabled={!address || !selectedItem || loading}
                className="rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                List selected item
              </button>
            </div>
          </div>
          {!address ? (
            <p className="mt-3 text-sm text-slate-400">Guest mode: you can view active listings. Connect wallet to list, buy, or cancel.</p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {marketplace.length > 0 ? (
              marketplace.map((listing) => (
                <div key={listing.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="font-semibold text-white">{listing.item?.name ?? 'Unknown item'}</p>
                  {listing.item ? (
                    <p className="mt-1 text-sm text-slate-300">
                      {listing.item.rarity} · Lv {listing.item.level} · Durability {listing.item.durability}/{listing.item.maxDurability}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Item details unavailable</p>
                  )}
                  <p className="text-sm text-slate-400">
                    Seller: {shortAddress(listing.seller)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">Price: {listing.price} mist</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleBuyListing(listing)}
                      disabled={!address || loading || listing.seller === address}
                      className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelListing(listing)}
                      disabled={loading || listing.seller !== address}
                      className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No active listings yet.</p>
            )}
          </div>
        </section>

        <footer className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-sm text-slate-400">
          <p>{status || 'Ready to demonstrate on-chain stateful object items.'}</p>
          {lastTxUrl ? (
            <p className="mt-2 text-sky-300">
              Latest transaction:{' '}
              <a
                href={lastTxUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-sky-500/60 underline-offset-2 hover:text-sky-200"
              >
                Open on SuiScan
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-slate-500">Tip: Use Slush wallet on Testnet and set VITE_SUI_ITEM_PACKAGE_ID in .env for your deployed module.</p>
        </footer>
      </div>
    </div>
  )
}

function buildSuiScanTxUrl(digest: string): string {
  return `https://suiscan.xyz/testnet/tx/${digest}`
}

function shortAddress(address: string): string {
  if (!address) return 'Unknown'
  if (address.length <= 14) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function rarityToBonus(rarity: GameItem['rarity']): number {
  switch (rarity) {
    case 'Legendary':
      return 6
    case 'Epic':
      return 4
    case 'Rare':
      return 2
    case 'Common':
    default:
      return 1
  }
}

export default App
