import Phaser from 'phaser';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';

const COLORS = {
  bg: 0x0f172a,
  player: 0x38bdf8,
  enemy: 0xf87171,
  button: 0x1e293b,
  buttonHover: 0x334155,
  buttonDisabled: 0x475569,
  text: '#e2e8f0',
  victory: '#22c55e',
  defeat: '#ef4444',
};

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    const { width, height } = this.scale;

    this.player = new Player({ name: 'Hero', hp: 100 });
    this.enemy = new Enemy({ name: 'Slime', hp: 100 });
    this.battleOver = false;
    this.busy = false;

    this.add
      .text(width / 2, 60, 'Battle Arena', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.playerNameText = this.add
      .text(width * 0.25, 160, this.player.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add.rectangle(width * 0.25, 290, 140, 180, COLORS.player).setStrokeStyle(3, 0xffffff, 0.4);

    this.playerHpText = this.add
      .text(width * 0.25, 410, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.enemyNameText = this.add
      .text(width * 0.75, 160, this.enemy.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add.rectangle(width * 0.75, 290, 140, 180, COLORS.enemy).setStrokeStyle(3, 0xffffff, 0.4);

    this.enemyHpText = this.add
      .text(width * 0.75, 410, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.logText = this.add
      .text(width / 2, 470, 'Press Attack to engage!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: COLORS.text,
        align: 'center',
      })
      .setOrigin(0.5);

    this.bonusText = this.add
      .text(width / 2, 505, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#94a3b8',
        align: 'center',
      })
      .setOrigin(0.5);

    this.resultText = this.add
      .text(width / 2, 100, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: COLORS.victory,
      })
      .setOrigin(0.5);

    const buttonX = width / 2;
    const buttonY = height - 70;
    this.buttonBg = this.add
      .rectangle(buttonX, buttonY, 220, 60, COLORS.button)
      .setStrokeStyle(2, 0x38bdf8, 0.8)
      .setInteractive({ useHandCursor: true });

    this.buttonLabel = this.add
      .text(buttonX, buttonY, 'Attack', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.buttonBg.on('pointerover', () => {
      if (!this.battleOver) this.buttonBg.setFillStyle(COLORS.buttonHover);
    });
    this.buttonBg.on('pointerout', () => {
      if (!this.battleOver) this.buttonBg.setFillStyle(COLORS.button);
    });
    this.buttonBg.on('pointerdown', () => this.handleAttack());

    this.updateHpTexts();
    this.updateBonusText();
  }

  updateHpTexts() {
    this.playerHpText.setText(`HP ${this.player.hp}/${this.player.maxHp}`);
    this.enemyHpText.setText(`HP ${this.enemy.hp}/${this.enemy.maxHp}`);
  }

  disableButton() {
    this.buttonBg.disableInteractive();
    this.buttonBg.setFillStyle(COLORS.buttonDisabled);
    this.buttonLabel.setColor('#94a3b8');
  }

  getBattleModifiers() {
    const hook = typeof window !== 'undefined' ? window.getBattleModifiers : undefined;
    const fromHook = typeof hook === 'function' ? hook() : null;
    return {
      attackBonus: Number(fromHook?.attackBonus ?? 0),
      defenseBonus: Number(fromHook?.defenseBonus ?? 0),
      itemLabel: fromHook?.itemLabel || 'No item selected',
    };
  }

  updateBonusText() {
    const modifiers = this.getBattleModifiers();
    this.bonusText.setText(
      `${modifiers.itemLabel} | ATK +${modifiers.attackBonus} | DEF +${modifiers.defenseBonus}`,
    );
  }

  async handleAttack() {
    if (this.battleOver || this.busy) return;
    this.busy = true;

    try {
      const hook = typeof window !== 'undefined' ? window.onPlayerAttack : undefined;
      if (typeof hook === 'function') {
        const result = await Promise.resolve(hook());
        if (result && typeof result === 'object' && result.canProceed === false) {
          this.logText.setText(result.message || 'Cannot attack now.');
          this.updateBonusText();
          this.busy = false;
          return;
        }
      }
    } catch (err) {
      console.error('[BattleScene] onPlayerAttack hook failed:', err);
    }

    const modifiers = this.getBattleModifiers();
    this.updateBonusText();
    const playerDmg = this.player.attack(this.enemy, modifiers.attackBonus);
    this.updateHpTexts();
    this.logText.setText(`${this.player.name} hits ${this.enemy.name} for ${playerDmg}.`);

    if (this.enemy.isDead()) {
      this.resultText.setColor(COLORS.victory).setText('Victory!');
      this.disableButton();
      this.battleOver = true;
      try {
        const victoryHook = typeof window !== 'undefined' ? window.onBattleVictory : undefined;
        if (typeof victoryHook === 'function') {
          await Promise.resolve(victoryHook());
        }
      } catch (err) {
        console.error('[BattleScene] onBattleVictory hook failed:', err);
      }
      this.busy = false;
      return;
    }

    const enemyDmg = this.enemy.attack(this.player, modifiers.defenseBonus);
    this.updateHpTexts();
    this.logText.setText(
      `${this.player.name} hits for ${playerDmg}. ${this.enemy.name} counters for ${enemyDmg}.`,
    );

    if (this.player.isDead()) {
      this.resultText.setColor(COLORS.defeat).setText('Defeat');
      this.disableButton();
      this.battleOver = true;
    }

    this.busy = false;
  }
}
