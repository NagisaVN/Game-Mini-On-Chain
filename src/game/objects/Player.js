import Phaser from 'phaser';

export default class Player {
  constructor({ name = 'Hero', hp = 100 } = {}) {
    this.name = name;
    this.maxHp = hp;
    this.hp = hp;
  }

  attack(target, attackBonus = 0) {
    const baseDmg = Phaser.Math.Between(5, 15);
    const dmg = Math.max(1, baseDmg + attackBonus);
    target.hp = Math.max(0, target.hp - dmg);
    return dmg;
  }

  isDead() {
    return this.hp <= 0;
  }
}
