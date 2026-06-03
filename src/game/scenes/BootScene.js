export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  preload() {
    // Загрузка спрайтов
    this.load.image('head', '/assets/head.png');
    this.load.image('body', '/assets/body.png');
    this.load.image('dog', '/assets/dog.png');
    this.load.image('cat', '/assets/cat.png');
    this.load.image('tv', '/assets/tv.png');
    this.load.image('petbox', '/assets/petbox.png');
  }
  create() {
    this.scene.start('WorldScene');
  }
}