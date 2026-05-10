import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Placeholder: no external assets in this MVP. Shapes and text are drawn at runtime.
  }

  create() {
    this.scene.start('BattleScene');
  }
}
