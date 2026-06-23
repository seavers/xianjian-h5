import { state } from '../engine/state.js';
import { loadPal, loadBall, loadPic } from '../resources/pal.js';
import { loadMkf } from '../resources/loader.js';
import { UI } from './panel.js';
import { update } from './draw.js';

export const Shop = {
  storeId: 0,
  storeItems: [],
  sellableItems: [],
  selectedIndex: 0,
  scrollIndex: 0, // 滚动视口起始索引
  confirming: false,
  confirmValue: 0, // 0: 否, 1: 是
  resolve: null,
  timer: null,
  isSelling: false, // 标识当前是否在卖出模式下

  async open(storeId) {
    this.isSelling = false;
    this.storeId = storeId;
    this.selectedIndex = 0;
    this.scrollIndex = 0;
    this.confirming = false;
    this.confirmValue = 0;

    // 步骤 1：若未加载商店数据，则从 data.mkf #0 中载入
    this.ensureStoresLoaded();

    this.storeItems = state.stores[storeId] || [];
    if (this.storeItems.length === 0) {
      console.warn(`[Shop] 商店 ID ${storeId} 内没有可售商品`);
      return;
    }

    // 步骤 2：在呼出商店前强制进行一次同步的整体重绘，以生成静态底图
    update(true);

    // 步骤 3：切换交互状态至 'shop'，并显示 startup 交互 Canvas 层
    state.uiMode = 'shop';
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }

    // 步骤 4：开启 80ms 自动闪烁高亮绘制定时器，以便平滑闪烁选中项
    this.startDrawLoop();

    // 步骤 5：以 Promise 形式挂起运行，直到按 ESC 退出
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  },

  async openSellMenu() {
    this.isSelling = true;
    this.selectedIndex = 0;
    this.scrollIndex = 0;
    this.confirming = false;
    this.confirmValue = 0;

    // 步骤 1：在呼出卖出菜单前强制进行一次同步的整体重绘，以生成静态底图
    update(true);

    // 步骤 2：切换交互状态至 'shop'，并显示 startup 交互 Canvas 层
    state.uiMode = 'shop';
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }

    // 步骤 3：开启 80ms 自动闪烁高亮绘制定时器
    this.startDrawLoop();

    // 步骤 4：以 Promise 形式挂起运行，直到按 ESC 退出
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  },

  ensureStoresLoaded() {
    if (!state.stores || state.stores.length === 0) {
      const data = loadMkf('data.mkf', 0);
      if (!data) return;

      const view = data.toDataView();
      const num = data.length / 18; // 每个商店 9 个 WORD (18 字节)
      state.stores = [];

      for (let i = 0; i < num; i++) {
        const items = [];
        for (let j = 0; j < 9; j++) {
          const itemId = view.nextShort();
          if (itemId !== 0) {
            items.push(itemId);
          }
        }
        state.stores.push(items);
      }
      console.log(`载入商店数据 ${state.stores.length} 个`);
    }
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

  draw() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    // 步骤 0.5：在每次重绘菜单组件前，强行将底层大地图和角色再次同步重绘，防止底图变黑或被清空
    update(true);

    // 步骤 1：清空当前交互层 Canvas 以准备重绘
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    if (this.isSelling) {
      this.drawSellMenu(startupCtx);
    } else {
      this.drawBuyMenu(startupCtx);
    }
  },

  drawBuyMenu(startupCtx) {
    // 步骤 2：绘制右侧可供挑选的商品大卷轴框 (x: 122, y: 8, width: 9, height: 9)
    UI.drawArea(122, 8, 9, 9, 10);

    const palette = loadPal(state.paletteId);
    const time = Date.now();
    const colorIndex = 0xF9 + Math.floor((time / 100) % 6); // 249-254 颜色依次循环
    const highlightColor = palette[colorIndex] & 0x00FFFFFF;
    const normalColor = 0xD4D0C0;

    // 步骤 3：逐行渲染当前商店商品名称和价格 (限制最大可见为 9，且防止溢出大红框)
    for (let i = 0; i < 9; i++) {
      const itemIdx = this.scrollIndex + i;
      if (itemIdx >= this.storeItems.length) break;

      const itemId = this.storeItems[itemIdx];
      const itemConfig = state.items[itemId];
      if (!itemConfig) continue;

      const isSelected = (this.selectedIndex === itemIdx && !this.confirming);
      const color = isSelected ? highlightColor : normalColor;

      // 绘制商品名称
      UI.drawWord(itemId, 150, 22 + i * 18, color);

      // 绘制商品价格 (数字比文字偏下 5 像素以完美对齐)
      UI.drawNum(itemConfig.gold, 268, 27 + i * 18, 'yellow');
    }

    // 步骤 4：绘制左上方选中商品的挂画大底框及其球形大图标 (x: 40, y: 8)
    const boxImg = loadPic(71);
    if (boxImg) {
      startupCtx.drawImage(boxImg, 40, 8);
    }

    const currentItemId = this.storeItems[this.selectedIndex];
    const currentItemConfig = state.items[currentItemId];
    if (currentItemConfig) {
      const ballImg = loadBall(currentItemConfig.roleId);
      if (ballImg) {
        startupCtx.drawImage(ballImg, 48, 15);
      }
    }

    // 步骤 5：计算并绘制左侧“现有”及数量框 (现有短语 ID: 35)
    UI.drawLabel(20, 100, 5);
    UI.drawWord(35, 28, 109, 0x000000);

    // 检索计算自己行囊及各名队员装备中所包含的此商品总数
    let count = state.ownItems.filter(id => id === currentItemId).length;
    for (const role of state.party) {
      if (role && role.equipments) {
        for (let part = 0; part < 6; part++) {
          if (role.equipments[part] === currentItemId) {
            count++;
          }
        }
      }
    }
    // 数字偏下 4 像素（109 + 4 = 113）以与文字在卷轴小框内垂直居中对齐
    UI.drawNum(count, 102, 113, 'yellow');

    // 步骤 6：绘制左侧“金钱”及金额框 (金钱短语 ID: 21)
    UI.drawLabel(20, 141, 5);
    UI.drawWord(21, 28, 150, 0x000000);
    // 数字偏下 4 像素（150 + 4 = 154）以与文字在卷轴小框内垂直居中对齐
    UI.drawNum(state.money, 102, 154, 'yellow');

    // 步骤 7：若处于确认弹窗状态下，渲染“否/是”选择小框 (否 ID: 19, 是 ID: 20)
    if (this.confirming) {
      const yesNoColor = (val) => (this.confirmValue === val) ? highlightColor : 0x000000;

      // 绘制“否”按钮
      UI.drawLabel(130, 100, 2);
      UI.drawWord(19, 146, 109, yesNoColor(0));

      // 绘制“是”按钮
      UI.drawLabel(205, 100, 2);
      UI.drawWord(20, 221, 109, yesNoColor(1));
    }
  },

  drawSellMenu(startupCtx) {
    // 步骤 1.1：从玩家行囊中统计出所有可售卖的道具 (flags & 4 代表可售)
    const sellableItems = [];
    const itemCounts = {};
    const ownItems = state.ownItems || [];
    for (const id of ownItems) {
      const itemConfig = state.items[id];
      if (itemConfig && (itemConfig.flags & 4) !== 0) {
        if (itemCounts[id] === undefined) {
          itemCounts[id] = 0;
          sellableItems.push(id);
        }
        itemCounts[id]++;
      }
    }

    this.sellableItems = sellableItems; // 存储可售物品列表，供输入处理模块使用

    // 步骤 1.2：边界检查与保护
    if (this.selectedIndex >= sellableItems.length) {
      this.selectedIndex = Math.max(0, sellableItems.length - 1);
    }
    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
    }

    // 步骤 1.3：动态调整可见行数滚动 (3 列网格，可见为 7 行)
    this.adjustSellScroll(sellableItems.length);

    // 步骤 2：在顶部绘制三列可售卖道具的大红框背景 (0, 0, width: 18, height: 7, style: 10)
    UI.drawArea(0, 0, 18, 7, 10);

    const palette = loadPal(state.paletteId);
    const time = Date.now();
    const colorIndex = 0xF9 + Math.floor((time / 100) % 6);
    const highlightColor = palette[colorIndex] & 0x00FFFFFF;
    const normalColor = 0xD4D0C0;

    // 步骤 3：逐个绘制当前可视行的行囊道具名称与持有数量
    const n = sellableItems.length;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      // 如果超出当前可视视口（最多 7 行），则不渲染
      if (row < this.scrollIndex || row >= this.scrollIndex + 7) {
        continue;
      }

      const itemId = sellableItems[i];
      const xText = 28 + col * 88;
      const yText = 16 + (row - this.scrollIndex) * 18;
      const isSelected = (i === this.selectedIndex && !this.confirming);

      const color = isSelected ? highlightColor : normalColor;
      UI.drawWord(itemId, xText, yText, color);

      // 绘制数量 (只有大于 1 时才显示，数字偏下 4 像素对齐)
      const count = itemCounts[itemId];
      if (count > 1) {
        UI.drawNum(count, xText + 72, yText + 4, 'cyan');
      }

      // 绘制三角形选择指示器 (固定在第二个中文字符右侧)
      if (isSelected) {
        const arrowImg = loadPic(70);
        if (arrowImg) {
          startupCtx.drawImage(arrowImg, xText + 25, yText + 10);
        }
      }
    }

    // 步骤 4：在左下方绘制大挂画底框与大道具球 (0, 140)
    const boxImg = loadPic(71);
    if (boxImg) {
      startupCtx.drawImage(boxImg, 0, 140);
    }

    // 步骤 5：如果当前有选中的可售物品，在底框中央绘制大图标，并渲染金钱和售价框
    if (n > 0 && this.selectedIndex < n) {
      const currentItemId = sellableItems[this.selectedIndex];
      const currentItemConfig = state.items[currentItemId];
      if (currentItemConfig) {
        const ballImg = loadBall(currentItemConfig.roleId);
        if (ballImg) {
          startupCtx.drawImage(ballImg, 8, 147);
        }
      }

      // 绘制金钱标签框 (x: 100, y: 150) 与金钱数值 (居中对齐)
      UI.drawLabel(100, 150, 5);
      UI.drawWord(21, 108, 159, 0x000000);
      UI.drawNum(state.money, 188, 163, 'yellow');

      // 绘制售价标签框 (x: 224, y: 150) 与售价数值 (原价的一半，居中对齐)
      UI.drawLabel(224, 150, 5);
      UI.drawWord(25, 232, 159, 0x000000);
      if (currentItemConfig) {
        const price = Math.floor(currentItemConfig.gold / 2);
        UI.drawNum(price, 312, 163, 'yellow');
      }
    } else {
      // 若无可售道具，只绘制默认金钱框即可
      UI.drawLabel(100, 150, 5);
      UI.drawWord(21, 108, 159, 0x000000);
      UI.drawNum(state.money, 188, 163, 'yellow');
    }

    // 步骤 6：如果处于弹窗确认状态，绘制“否/是”选择小框 (x: 120 / 200, y: 100)
    if (this.confirming) {
      const yesNoColor = (val) => (this.confirmValue === val) ? highlightColor : 0x000000;

      // 绘制“否”按钮
      UI.drawLabel(120, 100, 2);
      UI.drawWord(19, 136, 109, yesNoColor(0));

      // 绘制“是”按钮
      UI.drawLabel(200, 100, 2);
      UI.drawWord(20, 211, 109, yesNoColor(1));
    }
  },

  adjustScroll() {
    if (this.selectedIndex < this.scrollIndex) {
      this.scrollIndex = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollIndex + 9) {
      this.scrollIndex = this.selectedIndex - 9 + 1;
    }
    this.scrollIndex = Math.max(0, Math.min(this.scrollIndex, this.storeItems.length - 9));
  },

  adjustSellScroll(totalCount) {
    const totalRows = Math.ceil(totalCount / 3);
    const currentRow = Math.floor(this.selectedIndex / 3);

    if (currentRow < this.scrollIndex) {
      this.scrollIndex = currentRow;
    } else if (currentRow >= this.scrollIndex + 7) {
      this.scrollIndex = currentRow - 7 + 1;
    }
    this.scrollIndex = Math.max(0, Math.min(this.scrollIndex, totalRows - 7));
  },

  onInput(input) {
    if (this.isSelling) {
      this.onSellInput(input);
    } else {
      this.onBuyInput(input);
    }
  },

  onBuyInput(input) {
    if (this.confirming) {
      // 步骤 1.1：处理确认弹窗选择时的按键
      switch (input) {
        case 'left':
        case 'right': {
          this.confirmValue = (this.confirmValue === 0) ? 1 : 0;
          this.draw();
          break;
        }
        case 'ESC':
        case 'e': {
          this.confirming = false;
          this.draw();
          break;
        }
        case 'blank': {
          if (this.confirmValue === 1) {
            // 选择是：扣除金钱并添加至行囊
            const itemId = this.storeItems[this.selectedIndex];
            const itemConfig = state.items[itemId];
            if (itemConfig && state.money >= itemConfig.gold) {
              state.money -= itemConfig.gold;
              state.ownItems.push(itemId);
            }
          }
          this.confirming = false;
          this.draw();
          break;
        }
      }
    } else {
      // 步骤 1.2：处理浏览商品列表时的按键
      switch (input) {
        case 'up': {
          this.selectedIndex = (this.selectedIndex - 1 + this.storeItems.length) % this.storeItems.length;
          this.adjustScroll();
          this.draw();
          break;
        }
        case 'down': {
          this.selectedIndex = (this.selectedIndex + 1) % this.storeItems.length;
          this.adjustScroll();
          this.draw();
          break;
        }
        case 'blank': {
          const itemId = this.storeItems[this.selectedIndex];
          const itemConfig = state.items[itemId];
          // 仅在持有金钱足够买入时，才弹出确认框
          if (itemConfig && state.money >= itemConfig.gold) {
            this.confirming = true;
            this.confirmValue = 0; // 默认选中否以防误操作
            this.draw();
          }
          break;
        }
        case 'ESC':
        case 'e': {
          // 退出商店，还原模式与脚本步进
          this.close();
          break;
        }
      }
    }
  },

  onSellInput(input) {
    const list = this.sellableItems || [];
    if (list.length === 0) {
      if (input === 'ESC' || input === 'e') {
        this.close();
      }
      return;
    }

    if (this.confirming) {
      switch (input) {
        case 'left':
        case 'right': {
          this.confirmValue = (this.confirmValue === 0) ? 1 : 0;
          this.draw();
          break;
        }
        case 'ESC':
        case 'e': {
          this.confirming = false;
          this.draw();
          break;
        }
        case 'blank': {
          if (this.confirmValue === 1) {
            // 选择是：减去行囊内此道具一件，并将金额增加原价的一半
            const itemId = list[this.selectedIndex];
            const itemConfig = state.items[itemId];
            if (itemConfig) {
              const idx = state.ownItems.indexOf(itemId);
              if (idx !== -1) {
                state.ownItems.splice(idx, 1);
                state.money += Math.floor(itemConfig.gold / 2);
              }
            }
          }
          this.confirming = false;
          this.draw();
          break;
        }
      }
    } else {
      switch (input) {
        case 'up': {
          if (this.selectedIndex >= 3) {
            this.selectedIndex -= 3;
            this.draw();
          }
          break;
        }
        case 'down': {
          if (this.selectedIndex + 3 < list.length) {
            this.selectedIndex += 3;
            this.draw();
          }
          break;
        }
        case 'left': {
          if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.draw();
          }
          break;
        }
        case 'right': {
          if (this.selectedIndex + 1 < list.length) {
            this.selectedIndex++;
            this.draw();
          }
          break;
        }
        case 'blank': {
          // 可售商品按确认，弹出确认框，默认选中否
          this.confirming = true;
          this.confirmValue = 0;
          this.draw();
          break;
        }
        case 'ESC':
        case 'e': {
          this.close();
          break;
        }
      }
    }
  },

  close() {
    this.stopDrawLoop();

    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }

    state.uiMode = 'operate';
    this.isSelling = false;

    if (this.resolve) {
      this.resolve();
      this.resolve = null;
    }
  }
};
