import { create } from 'zustand'
import type { GameItem } from '../types/game'

interface GameState {
  address: string
  inventory: GameItem[]
  loading: boolean
  status: string
  setAddress: (address: string) => void
  setInventory: (inventory: GameItem[]) => void
  setLoading: (loading: boolean) => void
  setStatus: (status: string) => void
}

export const useGameStore = create<GameState>((set) => ({
  address: '',
  inventory: [],
  loading: false,
  status: 'Ready to connect your Sui wallet.',
  setAddress: (address) => set({ address }),
  setInventory: (inventory) => set({ inventory }),
  setLoading: (loading) => set({ loading }),
  setStatus: (status) => set({ status }),
}))
