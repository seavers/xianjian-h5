import { state } from '../engine/state.js';
import { loadPic, loadWord } from '../resources/pal.js';
import { bind, unbind } from './input.js';

export const UI = {
  drawLabel(x, y, size) {
    drawPic3(45, x, y, size);
  },

  drawNum(num, x, y) {
    let currNum = num;
    let currX = x;
    while (true) {
      currX -= 6;
      const n = currNum % 10;
      drawPic(20 + n, currX, y);

      currNum -= n;
      currNum /= 10;
      if (currNum === 0) {
        break;
      }
    }
  },

  drawArea(x, y, width, height, style = 1) {
    const w = width - 1; // 减1的意思是: width, height是指交叉的地方, 交叉的地方用来输出汉字
    const h = height - 1;

    let currY = y;
    currY += drawPic3(style + 0, x, currY, w);
    for (let i = 0; i < h; i++) {
      currY += drawPic3(style + 3, x, currY, w);
    }
    currY += drawPic3(style + 6, x, currY, w);
  },

  drawWord(wordId, x, y, color) {
    const word = state.words[wordId];
    if (!word) return;
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    for (let i = 0; i < word.length / 2; i++) {
      const charCode = word.getShort(i * 2);
      if (charCode === 0x2020) { // 空格
        continue;
      }
      const img = loadWord(charCode, color);
      if (img) {
        startupCtx.drawImage(img, x + i * 16, y);
      }
    }
  },

  drawPics(data, x, y) {
    const rows = data.length;
    const cols = data[0].length;
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    let dy = 0;
    for (let j = 0; j < rows; j++) {
      let dx = 0;
      for (let i = 0; i < cols; i++) {
        const d = data[j][i];
        const pic = loadPic(d);
        if (pic) {
          startupCtx.drawImage(pic, x + dx, y + dy);
          dx += pic.width;
        }
      }
      const testPic = loadPic(data[j][0]);
      if (testPic) {
        dy += testPic.height;
      }
    }
  }
};

function drawPic(picId, x, y) {
  const startupCtx = state.contexts.startup;
  if (!startupCtx) return;
  const pic = loadPic(picId);
  if (pic) {
    startupCtx.drawImage(pic, x, y);
  }
}

function drawPic3(picId, x, y, n) {
  const startupCtx = state.contexts.startup;
  if (!startupCtx) return 0;
  let dx = 0;

  let pic = loadPic(picId);
  if (pic) {
    startupCtx.drawImage(pic, x, y);
    dx += pic.width;
  }

  for (let i = 0; i < n; i++) {
    pic = loadPic(picId + 1);
    if (pic) {
      startupCtx.drawImage(pic, x + dx, y);
      dx += pic.width;
    }
  }

  pic = loadPic(picId + 2);
  if (pic) {
    startupCtx.drawImage(pic, x + dx, y);
  }

  return pic ? pic.height : 0;
}

export class Panel {
  constructor(arr, style) {
    this.arr = arr;
    this.style = style; // 如使用的是 10 号 style, 则左上角pic的picId = 10
    this.value = 0;
    this.closable = true;
    this.width = null;
    this.height = null;
    this.listeners = [];
  }

  skin(style) {
    this.style = style;
    return this;
  }

  canClose(bool) {
    this.closable = bool;
    return this;
  }

  size(width, height) {
    this.width = width;
    this.height = height;
    return this;
  }

  show(x, y) {
    this.x = x;
    this.y = y;
    this.draw();
    this.listen();
    return this;
  }

  draw() {
    this.width = this.width || 2;
    this.height = this.height || this.arr.length;

    let x = this.x;
    let y = this.y;
    const height = this.height;
    const width = this.width;
    const style = this.style;
    const arr = this.arr;
    
    let xx = 0;
    let yy = 0;

    if (style) {
      UI.drawArea(x, y, width, height, style);
      x += 12;
      y += 12;
    }

    for (let i = 0; i < arr.length; i++) {
      const color = this.value === i ? 0xF4E46C : 0xD4D0C0;

      UI.drawWord(arr[i], x + xx * 100, y + yy * 18, color);

      if (style >= 10) {
        if (++xx >= 3) {
          yy++;
          xx = 0;
        }
      } else {
        yy++;
      }
    }
  }

  change() {
    this.draw();
  }

  choose() {
    this.fire();
  }

  listen() {
    const n = this.width < 10 ? 1 : 3;

    bind((ev) => {
      switch (ev.keyCode) {
        case 27: // ESC
        case 69: { // E
          const startupCanvas = document.getElementById('startup');
          if (startupCanvas) {
            startupCanvas.style.display = 'none';
          }
          unbind();
          break;
        }

        case 13: // 回车
        case 32: { // 空格
          this.choose();
          unbind();
          break;
        }
        case 37: { // 左
          this._calc(-1, false);
          this.change();
          break;
        }
        case 38: { // 上
          this._calc(-n, true);
          this.change();
          break;
        }
        case 39: { // 右
          this._calc(+1, false);
          this.change();
          break;
        }
        case 40: { // 下
          this._calc(+n, true);
          this.change();
          break;
        }
      }
    }, this);
  }

  _calc(add, bool) {
    let value = this.value;
    const total = this.arr.length;
    const n = this.width < 10 ? 1 : 3;

    if (n === 1) {
      if (bool) { // 上下
        value = value + add;
        if (value < 0) {
          value = value + total;
        }
        value = value % total;
      }
    } else {
      if (!bool) { // 左右
        const mod = value % 3;
        if (mod + add >= 0 && mod + add < 3 && value + add < total) {
          value = value + add;
        }
      } else { // 上下
        if (value + add >= 0 && value + add < total) {
          value = value + add;
        }
      }
    }

    this.value = value;
  }

  onchange(callback) {
    this.listeners.push(callback);
  }

  onclose(callback) {
    this.listeners.push(callback);
  }

  fire() {
    for (let i = 0; i < this.listeners.length; i++) {
      const listener = this.listeners[i];
      if (listener) {
        listener(this.arr[this.value]);
      }
    }
  }
}

export const PanelFactory = {
  // 纯文字
  create(arr) {
    return new Panel(arr, 0);
  },
  // List UI
  createList(arr) {
    return new Panel(arr, 1);
  },
  // Table UI
  createTable(arr) {
    return new Panel(arr, 10);
  }
};
