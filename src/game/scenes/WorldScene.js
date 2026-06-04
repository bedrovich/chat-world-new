import Phaser from 'phaser';
import { MAP, TV_POS, TV_SIZE, PET_BOX_POS, PET_BOX_SIZE, PLAYER, PET, BUBBLE, MOVEMENT } from '../config';

const tintedBodyCache = new Map();
const tintedPetCache = new Map();

function colorToHex(color) {
  if (!color) return '#ffffff';
  if (typeof color === 'string') return color;
  if (typeof color === 'object' && 'r' in color) {
    return '#' + ((1 << 24) + (color.r << 16) + (color.g << 8) + color.b).toString(16).slice(1);
  }
  return '#ffffff';
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}

function replaceColorOnCanvas(baseImage, targetColorHex, checkColorHex = '#ffffff') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = baseImage.width;
  canvas.height = baseImage.height;
  ctx.drawImage(baseImage, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const check = hexToRgb(checkColorHex);
  const target = hexToRgb(targetColorHex);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === check.r && data[i+1] === check.g && data[i+2] === check.b && data[i+3] > 0) {
      data[i] = target.r;
      data[i+1] = target.g;
      data[i+2] = target.b;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export default class WorldScene extends Phaser.Scene {
  constructor() { super({ key: 'WorldScene' }); }

  preload() {
    this.load.image('body_orig', '/assets/body.png');
    this.load.image('head', '/assets/head.png');
    this.load.image('dog_orig', '/assets/dog.png');
    this.load.image('cat_orig', '/assets/cat.png');
    this.load.image('tv', '/assets/tv.png');
    this.load.image('petbox', '/assets/pet-box.png');
  }

  create() {
    this.socket = this.registry.get('socket');
    this.players = this.add.group();
    this.pets = this.add.group();
    this.playerSprites = new Map();
    this.petSprites = new Map();
    this.prevPetX = new Map(); // для отслеживания направления движения питомца
    this.emojiOffsetX = new Map(); // ← добавь эту строку

    // Сетка
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x2a2a35);
    for (let x = 0; x <= MAP.w; x += 100) graphics.moveTo(x, 0).lineTo(x, MAP.h);
    for (let y = 0; y <= MAP.h; y += 100) graphics.moveTo(0, y).lineTo(MAP.w, y);
    graphics.strokePath();

    // Телевизор и коробка
    this.tvSprite = this.add.image(TV_POS.x, TV_POS.y, 'tv').setDisplaySize(TV_SIZE.w, TV_SIZE.h);
    this.tvZone = this.add.zone(TV_POS.x, TV_POS.y, TV_SIZE.w, TV_SIZE.h).setInteractive();
    this.petBoxSprite = this.add.image(PET_BOX_POS.x, PET_BOX_POS.y, 'petbox').setDisplaySize(PET_BOX_SIZE.w, PET_BOX_SIZE.h);
    this.petBoxZone = this.add.zone(PET_BOX_POS.x, PET_BOX_POS.y, PET_BOX_SIZE.w, PET_BOX_SIZE.h).setInteractive();

    this.input.keyboard.on('keydown-E', () => {
      const myId = this.registry.get('currentPlayerId');
      const mySprite = this.playerSprites.get(myId);
      if (!mySprite) return;
      const pos = { x: mySprite.container.x, y: mySprite.container.y };
      if (Phaser.Geom.Rectangle.ContainsPoint(this.tvZone.getBounds(), pos))
        window.dispatchEvent(new CustomEvent('openTvModal'));
      else if (Phaser.Geom.Rectangle.ContainsPoint(this.petBoxZone.getBounds(), pos))
        window.dispatchEvent(new CustomEvent('openPetModal'));
    });

    this.cameras.main.setBounds(-800, -400, MAP.w * 2, MAP.h * 2);

    const playersData = this.registry.get('playersData');
    const petsData = this.registry.get('petsData');
    Object.values(playersData).forEach(p => this.addPlayer(p));
    Object.values(petsData).forEach(p => this.addPet(p));

    this.socket.on('playerJoined', (p) => this.addPlayer(p));
    this.socket.on('playerLeft', (id) => {
      const data = this.playerSprites.get(id);
      if (data) { data.container.destroy(); this.playerSprites.delete(id); }
    });
    this.socket.on('playerMoved', (data) => {
      const p = this.playerSprites.get(data.id);
      if (p) p.container.setPosition(data.x, data.y);
    });
    this.socket.on('playerNameUpdate', (data) => {
      const p = this.playerSprites.get(data.id);
      if (p) {
        if (data.name) p.nameText.setText(data.name);
        if (data.emoji) p.emojiText.setText(data.emoji);
        if (data.color) this.updatePlayerColor(p, data.color);
      }
    });
    this.socket.on('pets_update', (updated) => {
  for (const [id, pet] of Object.entries(updated)) {
    const petId = parseInt(id);
    const petObj = this.petSprites.get(petId);
    if (petObj) {
      petObj.sprite.setPosition(pet.x, pet.y);
      
      // Определяем актуальное смещение эмодзи в зависимости от флипа
      const isFlipped = petObj.sprite.flipX;
      const currentOffsetX = isFlipped ? -PET.emojiOffsetX : PET.emojiOffsetX;
      petObj.nameText.setPosition(pet.x, pet.y + PET.nameOffsetY);
      petObj.emojiText.setPosition(pet.x + currentOffsetX, pet.y + PET.emojiOffsetY);
      
      // Сохраняем смещение для update()
      this.emojiOffsetX.set(petId, currentOffsetX);
      
      if (pet.color) this.updatePetColor(petObj, pet.color);
    } else {
      this.addPet(pet);
    }
  }
});
    this.socket.on('pet_created', (pet) => {
      this.addPet(pet);
      this.emojiOffsetX.set(pet.id, PET.emojiOffsetX);
  });
    this.socket.on('chatMessage', (msg) => {
      const player = this.playerSprites.get(msg.id);
      if (player) {
        this.showBubble(player.container, msg.text, msg.id === this.localPlayerId);
      }
    });
    
    this.socket.on('pet_speak', ({ petId, text }) => {
      const pet = this.petSprites.get(petId);
      if (pet) {
        this.showBubble(pet.sprite, text, false);
      }
    });

    this.keys = { w: false, a: false, s: false, d: false };
    const keyDownHandler = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'ц') this.keys.w = true;
      if (key === 'a' || key === 'ф') this.keys.a = true;
      if (key === 's' || key === 'ы') this.keys.s = true;
      if (key === 'd' || key === 'в') this.keys.d = true;
    };
    const keyUpHandler = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'ц') this.keys.w = false;
      if (key === 'a' || key === 'ф') this.keys.a = false;
      if (key === 's' || key === 'ы') this.keys.s = false;
      if (key === 'd' || key === 'в') this.keys.d = false;
    };
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    this.events.on('destroy', () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
    });

    this.localPlayerId = this.registry.get('currentPlayerId');

    const startCameraFollow = () => {
      const meData = this.playerSprites.get(this.localPlayerId);
      if (meData && meData.container) {
        this.cameras.main.startFollow(meData.container);
      } else {
        this.time.delayedCall(50, startCameraFollow, [], this);
      }
    };
    startCameraFollow();

    this.time.addEvent({
      delay: 1000 / 60,
      loop: true,
      callback: () => {
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        const isModalOpen = document.querySelector('.modal-overlay:not(.hidden)') !== null;
        if (isTyping || isModalOpen) return;

        const meData = this.playerSprites.get(this.localPlayerId);
        if (!meData) return;
        const me = meData.container;
        let dx = 0, dy = 0;
        if (this.keys.w) dy -= MOVEMENT.speed;
        if (this.keys.s) dy += MOVEMENT.speed;
        if (this.keys.a) dx -= MOVEMENT.speed;
        if (this.keys.d) dx += MOVEMENT.speed;
        if (dx !== 0 || dy !== 0) {
          if (dx !== 0 && dy !== 0) { dx *= MOVEMENT.diagonalFactor; dy *= MOVEMENT.diagonalFactor; }
          const newX = Phaser.Math.Clamp(Math.round(me.x + dx), 20, MAP.w - 20);
          const newY = Phaser.Math.Clamp(Math.round(me.y + dy), 20, MAP.h - 20);
          me.setPosition(newX, newY);
          this.socket.emit('move', { x: newX, y: newY });
        }
      }
    });

    this.registry.get('onGameReady')?.();
  }

  getTintedTexture(originalKey, targetColorHex, checkColorHex = '#ffffff', cacheMap) {
    const cacheKey = `${originalKey}_${targetColorHex}_${checkColorHex}`;
    if (cacheMap.has(cacheKey)) return cacheMap.get(cacheKey);

    const origTexture = this.textures.get(originalKey);
    if (!origTexture) return null;
    const frame = origTexture.getSourceImage();
    if (!frame) return null;

    const canvas = replaceColorOnCanvas(frame, targetColorHex, checkColorHex);
    const textureKey = `tinted_${originalKey}_${targetColorHex}`;
    this.textures.addCanvas(textureKey, canvas);
    const texture = this.textures.get(textureKey);
    cacheMap.set(cacheKey, texture);
    return texture;
  }

  addPlayer(p) {
    if (this.playerSprites.has(p.id)) return;

    const hexColor = colorToHex(p.color);
    const bodyTexture = this.getTintedTexture('body_orig', hexColor, '#ffffff', tintedBodyCache);
    const container = this.add.container(p.x, p.y);
    const body = this.add.image(0, PLAYER.bodyOffsetY, bodyTexture).setDisplaySize(PLAYER.bodySize.w, PLAYER.bodySize.h);
    const head = this.add.image(0, PLAYER.headOffsetY, 'head').setDisplaySize(PLAYER.headSize.w, PLAYER.headSize.h);
    container.add([body, head]);

    const nameText = this.add.text(0, PLAYER.nameOffsetY, p.name, { fontSize: `${PLAYER.nameFontSize}px`, color: '#fff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    const emojiText = this.add.text(0, PLAYER.emojiOffsetY, p.emoji || '😀', {
  fontSize: `${PLAYER.emojiFontSize}px`,
  padding: PLAYER.emojiPadding
}).setOrigin(0.5)
    container.add([nameText, emojiText]);

    this.playerSprites.set(p.id, { container, nameText, emojiText, body, head });
    this.players.add(container);
  }

  updatePlayerColor(playerData, newColor) {
    if (!playerData.body) return;
    const hexColor = colorToHex(newColor);
    const newTexture = this.getTintedTexture('body_orig', hexColor, '#ffffff', tintedBodyCache);
    if (newTexture) playerData.body.setTexture(newTexture);
  }

  addPet(pet) {
  if (this.petSprites.has(pet.id)) return;

  const baseKey = pet.type === 'dog' ? 'dog_orig' : 'cat_orig';
  const hexColor = colorToHex(pet.color || '#ffffff');
  const petTexture = this.getTintedTexture(baseKey, hexColor, '#ffffff', tintedPetCache);
  const sprite = this.add.image(pet.x, pet.y, petTexture).setDisplaySize(PET.spriteSize.w, PET.spriteSize.h);
  const nameText = this.add.text(pet.x, pet.y + PET.nameOffsetY, `${pet.gender}${pet.name}`, {
    fontSize: `${PET.nameFontSize}px`,
    color: '#fff'
  }).setOrigin(0.5);
  
  // Эмодзи — его смещение относительно спрайта (вправо, положительное)
  const emojiText = this.add.text(pet.x + PET.emojiOffsetX, pet.y + PET.emojiOffsetY, pet.emoji || '😀', {
    fontSize: `${PET.emojiFontSize}px`,
    padding: PET.emojiPadding
  }).setOrigin(0.5);
  
  this.petSprites.set(pet.id, { sprite, nameText, emojiText });
  this.pets.add(sprite);
  this.pets.add(nameText);
  this.pets.add(emojiText);
  
  this.prevPetX.set(pet.id, pet.x);
  // Сохраняем текущее состояние флипа и смещения для эмодзи
  this.emojiOffsetX.set(pet.id, PET.emojiOffsetX);
}

  updatePetColor(petData, newColor) {
    if (!petData.sprite) return;
    const baseKey = petData.sprite.texture.key.includes('dog') ? 'dog_orig' : 'cat_orig';
    const hexColor = colorToHex(newColor);
    const newTexture = this.getTintedTexture(baseKey, hexColor, '#ffffff', tintedPetCache);
    if (newTexture) petData.sprite.setTexture(newTexture);
  }

  showBubble(target, text, isMe) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${isMe ? 'me' : ''}`;
    bubble.textContent = text;
    document.getElementById('bubbles').appendChild(bubble);
    const screenPos = this.cameras.main.worldToScreen(target.x, target.y);
    bubble.style.left = `${screenPos.x}px`;
    bubble.style.top = `${screenPos.y + BUBBLE.offsetY}px`;
    setTimeout(() => { bubble.remove(); }, BUBBLE.duration);
  }

  update() {
  for (const [id, { sprite, nameText, emojiText }] of this.petSprites) {
    // Имя всегда по центру, не флипается
    nameText.setPosition(sprite.x, sprite.y + PET.nameOffsetY);
    
    // Эмодзи позиционируется с учётом текущего смещения
    let currentOffsetX = this.emojiOffsetX.get(id) ?? PET.emojiOffsetX;
    emojiText.setPosition(sprite.x + currentOffsetX, sprite.y + PET.emojiOffsetY);
    
    // Определяем направление движения, только если смещение значительное
    const prevX = this.prevPetX.get(id) ?? sprite.x;
    const deltaX = sprite.x - prevX;
    const THRESHOLD = PET.flipThreshold; // минимальное движение для смены флипа
    
    if (Math.abs(deltaX) > THRESHOLD) {
      const flip = deltaX < 0; // влево
      sprite.setFlipX(flip);
      emojiText.setFlipX(flip);
      
      const newOffsetX = flip ? -PET.emojiOffsetX : PET.emojiOffsetX;
      // Обновляем смещение только если оно изменилось
      if (currentOffsetX !== newOffsetX) {
        this.emojiOffsetX.set(id, newOffsetX);
        emojiText.setPosition(sprite.x + newOffsetX, sprite.y + PET.emojiOffsetY);
      }
    }
    this.prevPetX.set(id, sprite.x);
  }
}
}