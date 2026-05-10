import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import BattleScene from './scenes/BattleScene.js';

export function createGame(parentId = 'game-container') {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: parentId,
    backgroundColor: '#0f172a',
    scene: [BootScene, BattleScene],
  });
}
