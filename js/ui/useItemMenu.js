import { state } from '../engine/state.js';
import { loadPic, loadBall, loadWord } from '../resources/pal.js';
import { UI } from './panel.js';
import { update } from './draw.js';
import {
  COLOR_YELLOW,
  COLOR_GRAY,
  COLOR_LIGHT_RED,
  COLOR_DARK_RED
} from './colors.js';

let previousUiMode = 'operate';

export const UseItemMenu = {
  selectedIndex: 0,
  scrollRow: 0,
  resolve: null,
  timer: null,

  async open(filterBit = 1) {
    this.filterBit = filterBit;
    this.selectedIndex = 0;
    this.scrollRow = 0;

    // 步骤 1：同步重绘底图以生成静态底图，防止画面变黑
    update(true);

    // 步骤 2：切换当前交互状态至 'useItemMenu' 并将交互 Canvas 层显示出来
    previousUiMode = state.uiMode;
    state.uiMode = 'useItemMenu';
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }

    // 步骤 3：开启 80ms 自动闪烁绘制定时器
    this.startDrawLoop();

    // 步骤 4：返回 Promise 以阻塞脚本引擎的主逻辑
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  },

  startDrawLoop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.draw();
    this.timer = setInterval(() => {
      this.draw();
    }, 80);
  },

  stopDrawLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  getUsableItems() {
    const itemCounts = {};
    const uniqueItems = [];
    const ownItems = state.ownItems || [];
    const filter = this.filterBit !== undefined ? this.filterBit : 1;
    for (const id of ownItems) {
      const item = state.items[id];
      if (item && (item.flags & filter) !== 0) {
        if (itemCounts[id] === undefined) {
          itemCounts[id] = 0;
          uniqueItems.push(id);
        }
        itemCounts[id]++;
      }
    }
    return { uniqueItems, itemCounts };
  },

  draw() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    // 步骤 1：同步重绘底层场景和人物精灵
    update(true);

    // 步骤 2：清空当前交互 Canvas 层的画面
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    // 步骤 3：获取可用道具列表
    const { uniqueItems, itemCounts } = this.getUsableItems();
    const n = uniqueItems.length;

    // 步骤 4：防范选择索引越界
    if (this.selectedIndex >= n) {
      this.selectedIndex = Math.max(0, n - 1);
    }
    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
    }

    // 步骤 5：绘制大面板红色背景，使用 10 号 Skin（320x136 像素）
    UI.drawArea(0, 0, 18, 7, 10);

    // 步骤 6：在 3 列网格中绘制物品名称及数量
    for (let i = 0; i < n; i++) {
      const itemId = uniqueItems[i];
      const row = Math.floor(i / 3);
      const col = i % 3;

      // 只渲染位于当前可视范围内的行
      if (row < this.scrollRow || row >= this.scrollRow + 7) {
        continue;
      }

      const xText = 28 + col * 88;
      const yText = 16 + (row - this.scrollRow) * 18;
      const isSelected = (i === this.selectedIndex);

      // 确定绘制颜色，高亮选中项
      const color = isSelected ? COLOR_YELLOW : COLOR_GRAY;
      UI.drawWord(itemId, xText, yText, color);

      // 若当前物品数量大于 1，则在其右侧对齐处渲染蓝绿色的数字数量
      const count = itemCounts[itemId];
      if (count > 1) {
        UI.drawNum(count, xText + 72, yText + 8, 'cyan');
      }

      // 绘制高亮光标 (PIC #70)
      if (isSelected) {
        const arrowImg = loadPic(70);
        if (arrowImg) {
          startupCtx.drawImage(arrowImg, xText + 32, yText + 5);
        }
      }
    }

    // 步骤 7：在最左下角绘制小图标底框和球体大图标
    if (n > 0 && this.selectedIndex < n) {
      const currItemId = uniqueItems[this.selectedIndex];
      const boxImg = loadPic(71);
      if (boxImg) {
        startupCtx.drawImage(boxImg, 0, 140);
      }

      const itemConfig = state.items[currItemId];
      if (itemConfig) {
        const ballImg = loadBall(itemConfig.roleId);
        if (ballImg) {
          startupCtx.drawImage(ballImg, 8, 147);
        }
      }

      // 步骤 8：绘制描述文字
      const descBytes = state.desc[currItemId];
      if (descBytes) {
        let dx = 75;
        let dy = 144;
        let idx = 0;
        while (idx < descBytes.length) {
          const b = descBytes.getByte(idx);
          if (b === 42) {
            dx = 75;
            dy += 16;
            idx++;
          } else if (b === 32) {
            dx += 8;
            idx++;
          } else if (b < 128) {
            const img = loadWord(b, COLOR_YELLOW);
            if (img) {
              startupCtx.drawImage(img, dx, dy + 1);
            }
            dx += 8;
            idx++;
          } else {
            if (idx + 1 < descBytes.length) {
              const charCode = descBytes.getShort(idx);
              const img = loadWord(charCode, COLOR_YELLOW);
              if (img) {
                startupCtx.drawImage(img, dx, dy);
              }
              dx += 16;
              idx += 2;
            } else {
              idx++;
            }
          }
        }
      }
    }
  },

  updateScroll() {
    const currRow = Math.floor(this.selectedIndex / 3);
    if (currRow < this.scrollRow) {
      this.scrollRow = currRow;
    } else if (currRow >= this.scrollRow + 7) {
      this.scrollRow = currRow - 7 + 1;
    }
  },

  onInput(input) {
    const { uniqueItems } = this.getUsableItems();
    const n = uniqueItems.length;

    if (input === 'ESC' || input === 'e') {
      this.close(-1);
      return;
    }

    if (n === 0) return;

    if (this.selectedIndex >= n) {
      this.selectedIndex = n - 1;
    }
    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
    }

    if (input === 'left') {
      if (this.selectedIndex % 3 > 0) {
        this.selectedIndex--;
        this.updateScroll();
        this.draw();
      }
    } else if (input === 'right') {
      if (this.selectedIndex % 3 < 2 && this.selectedIndex + 1 < n) {
        this.selectedIndex++;
        this.updateScroll();
        this.draw();
      }
    } else if (input === 'up') {
      if (this.selectedIndex - 3 >= 0) {
        this.selectedIndex -= 3;
        this.updateScroll();
        this.draw();
      }
    } else if (input === 'down') {
      if (this.selectedIndex + 3 < n) {
        this.selectedIndex += 3;
        this.updateScroll();
        this.draw();
      }
    } else if (input === 'blank') {
      // 确认选择，返回选中的 itemId
      this.close(uniqueItems[this.selectedIndex]);
    }
  },

  close(result) {
    this.stopDrawLoop();
    state.uiMode = previousUiMode;
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }
    if (this.resolve) {
      this.resolve(result);
    }
  }
};
