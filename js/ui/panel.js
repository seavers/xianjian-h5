import { state } from '../engine/state.js';
import { loadPic, loadWord } from '../resources/pal.js';

export const UI = {
  drawLabel(x, y, size) {
    this.drawSingleLineBox(x, y, size);
  },

  drawSingleLineBox(x, y, length, ctx) {
    const drawCtx = ctx || state.contexts.startup;
    if (!drawCtx) return;

    const picLeft = loadPic(45);
    if (picLeft) {
      drawCtx.drawImage(picLeft, x, y);
    }

    const picMiddle = loadPic(46);
    if (picMiddle) {
      for (let i = 0; i < length; i++) {
        drawCtx.drawImage(picMiddle, x + 8 + i * 16, y);
      }
    }

    const picRight = loadPic(47);
    if (picRight) {
      drawCtx.drawImage(picRight, x + 8 + length * 16, y);
    }
  },

  drawNum(num, x, y, colorName = 'yellow') {
    let currNum = num;
    let currX = x;
    let base = 20; // 步骤 1：根据传入的颜色名选择正确的数字图片基准索引
    if (colorName === 'blue') {
      base = 30;
    } else if (colorName === 'cyan') {
      base = 57;
    }

    // 步骤 2：逐位计算并从低到高在屏幕上自右向左绘制数字图片
    while (true) {
      currX -= 6;
      const n = currNum % 10;
      drawPic(base + n, currX, y);

      currNum -= n;
      currNum /= 10;
      if (currNum === 0) {
        break;
      }
    }
  },

  drawSlash(x, y) {
    // 步骤 3：绘制 '/' 精灵小图（在 H5 资源包中索引为 40）
    drawPic(40, x, y);
  },

  drawArea(x, y, width, height, style = 1) {
    this.drawMultiLineBox(x, y, width, height, style);
  },

  drawMultiLineBox(x, y, width, height, style = 1, ctx) {
    const drawCtx = ctx || state.contexts.startup;
    if (!drawCtx) return;
    const w = width - 1; // 减1的意思是: width, height是指交叉的地方, 交叉的地方用来输出汉字
    const h = height - 1;

    let currY = y;
    currY += this.drawWinPic3(style + 0, x, currY, w, drawCtx);
    for (let i = 0; i < h; i++) {
      currY += this.drawWinPic3(style + 3, x, currY, w, drawCtx);
    }
    this.drawWinPic3(style + 6, x, currY, w, drawCtx);
  },

  // 绘制三段式九宫格单行边框块的辅助函数，支持指定绘制上下文
  drawWinPic3(picId, x, y, n, ctx) {
    const drawCtx = ctx || state.contexts.startup;
    if (!drawCtx) return 0;
    let dx = 0;
    let pic = loadPic(picId);

    if (pic) {
      drawCtx.drawImage(pic, x, y);
      dx += pic.width;
    }

    for (let i = 0; i < n; i++) {
      pic = loadPic(picId + 1);
      if (pic) {
        drawCtx.drawImage(pic, x + dx, y);
        dx += pic.width;
      }
    }

    pic = loadPic(picId + 2);
    if (pic) {
      drawCtx.drawImage(pic, x + dx, y);
    }

    return pic ? pic.height : 0;
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
  },

  drawPicFlippedY(picId, x, y, ctx) {
    const drawCtx = ctx || state.contexts.startup;
    if (!drawCtx) return;
    const pic = loadPic(picId);
    if (pic) {
      drawCtx.save();
      drawCtx.translate(x, y + pic.height);
      drawCtx.scale(1, -1);
      drawCtx.drawImage(pic, 0, 0);
      drawCtx.restore();
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
    this.scrollRow = 0;
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
    return this;
  }

  draw() {
    this.width = this.width || 2;
    const style = this.style;
    const arr = this.arr;

    // 步骤 1：确定当前面板的列数与总行数
    const cols = (style >= 10) ? 3 : 1;
    this.height = this.height || Math.ceil(arr.length / cols);
    const totalRows = Math.ceil(arr.length / cols);

    // 步骤 2：根据当前选中的项索引计算其所在行，并动态调整滚动条起始行位置以保证选中项可见
    const itemRow = Math.floor(this.value / cols);
    if (itemRow < this.scrollRow) {
      this.scrollRow = itemRow;
    } else if (itemRow >= this.scrollRow + this.height) {
      this.scrollRow = itemRow - this.height + 1;
    }
    this.scrollRow = Math.max(0, Math.min(this.scrollRow, totalRows - this.height));

    let x = this.x;
    let y = this.y;
    const height = this.height;
    const width = this.width;

    // 步骤 3：绘制面板背景区域
    if (style) {
      UI.drawArea(x, y, width, height, style);
      x += 12;
      y += 12;
    }

    // 步骤 4：迭代绘制仅在当前可视范围内的项，并根据滚动偏移量计算其相对 y 轴显示坐标
    for (let i = 0; i < arr.length; i++) {
      const rowIdx = Math.floor(i / cols);
      if (rowIdx < this.scrollRow || rowIdx >= this.scrollRow + height) {
        continue;
      }

      const xx = i % cols;
      const yy = rowIdx - this.scrollRow;
      const color = this.value === i ? 0xF4E46C : 0xD4D0C0;

      UI.drawWord(arr[i], x + xx * 100, y + yy * 18, color);
    }
  }

  change() {
    this.draw();
  }

  choose() {
    this.fire();
  }

  oncancel(callback) {
    this.cancelListener = callback;
    return this;
  }

  cancel() {
    if (!this.closable) return;
    if (this.cancelListener) {
      this.cancelListener();
    }
  }

  onInput(input) {
    const cols = (this.style >= 10) ? 3 : 1;
    switch (input) {
      case 'ESC':
      case 'e': { // 取消并返回
        this.cancel();
        break;
      }
      case 'blank': { // 确认选择
        this.choose();
        break;
      }
      case 'left': {
        this._calc(-1, false);
        this.change();
        break;
      }
      case 'up': {
        this._calc(-cols, true);
        this.change();
        break;
      }
      case 'right': {
        this._calc(+1, false);
        this.change();
        break;
      }
      case 'down': {
        this._calc(+cols, true);
        this.change();
        break;
      }
    }
  }

  _calc(add, bool) {
    let value = this.value;
    const total = this.arr.length;
    const cols = (this.style >= 10) ? 3 : 1;

    // 步骤 1：针对单列（列表）与多列（表格）执行不同的光标移动规则
    if (cols === 1) {
      if (bool) { // 上下移动
        value = value + add;
        if (value < 0) {
          value = value + total;
        }
        value = value % total;
      }
    } else {
      if (!bool) { // 左右移动
        const mod = value % 3;
        if (mod + add >= 0 && mod + add < 3 && value + add < total) {
          value = value + add;
        }
      } else { // 上下移动
        if (value + add >= 0 && value + add < total) {
          value = value + add;
        }
      }
    }

    this.value = value;
  }

  onchange(callback) {
    this.listeners.push(callback);
    return this;
  }

  onclose(callback) {
    this.listeners.push(callback);
    return this;
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
