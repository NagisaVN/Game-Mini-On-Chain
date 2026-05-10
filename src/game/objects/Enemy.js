import Phaser from 'phaser';

export default class Enemy {
  constructor({ name = 'Slime', hp = 100 } = {}) {
    this.name = name;
    this.maxHp = hp;
    this.hp = hp;
  }

  attack(target, defenseBonus = 0) {
    const baseDmg = Phaser.Math.Between(3, 10);
    const dmg = Math.max(1, baseDmg - defenseBonus);
    target.hp = Math.max(0, target.hp - dmg);
    return dmg;
  }

  isDead() {
    return this.hp <= 0;
  }
}
