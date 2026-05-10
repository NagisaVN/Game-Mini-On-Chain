import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from '../game/main.js'

type BattleHookResult = { canProceed: boolean; message?: string } | void

type BattleModifiers = {
  attackBonus: number
  defenseBonus: number
  itemLabel: string
}

type PhaserGameProps = {
  onPlayerAttack?: () => Promise<BattleHookResult> | BattleHookResult
  onBattleVictory?: () => Promise<void> | void
  getBattleModifiers?: () => BattleModifiers
}

declare global {
  interface Window {
    onPlayerAttack?: () => BattleHookResult | Promise<BattleHookResult>
    onBattleVictory?: () => void | Promise<void>
    getBattleModifiers?: () => BattleModifiers
  }
}

const CONTAINER_ID = 'game-container'

export default function PhaserGame({ onPlayerAttack, onBattleVictory, getBattleModifiers }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null)
  const attackHookRef = useRef(onPlayerAttack)
  const victoryHookRef = useRef(onBattleVictory)
  const modifiersHookRef = useRef(getBattleModifiers)

  attackHookRef.current = onPlayerAttack
  victoryHookRef.current = onBattleVictory
  modifiersHookRef.current = getBattleModifiers

  useEffect(() => {
    if (gameRef.current) return

    gameRef.current = createGame(CONTAINER_ID)

    window.onPlayerAttack = () => attackHookRef.current?.() ?? Promise.resolve()
    window.onBattleVictory = () => victoryHookRef.current?.()
    window.getBattleModifiers = () =>
      modifiersHookRef.current?.() ?? { attackBonus: 0, defenseBonus: 0, itemLabel: 'No item selected' }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      delete window.onPlayerAttack
      delete window.onBattleVictory
      delete window.getBattleModifiers
    }
  }, [])

  return (
    <div className="flex justify-center">
      <div
        id={CONTAINER_ID}
        className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl shadow-slate-950/40"
        style={{ width: 800, height: 600 }}
      />
    </div>
  )
}
