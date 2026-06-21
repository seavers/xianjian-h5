import { state } from '../engine/state.js';
import { loadPal, loadBall, loadPic, loadMkf } from '../resources/pal.js';
import { UI } from './panel.js';
import { update } from './draw.js';

export const Shop = {
  storeId: 0,
  storeItems: [],
  selectedIndex: 0,
  confirming: false,
  confirmValue: 0, // 0: 否, 1: 是
  resolve: null,
  timer: null,

  async open(storeId) {
    this.storeId = storeId;
    this.selectedIndex = 0;
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

    // 步骤 3：切换运行模式至 'shop'，并显示 startup 交互 Canvas 层
    state.currentMode = 'shop';
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

    // 步骤 1：清空当前交互层 Canvas 以准备重绘
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    // 步骤 2：绘制右侧可供挑选的商品大卷轴框 (x: 122, y: 8, width: 8, height: 8)
    UI.drawArea(122, 8, 8, 8, 1);

    const palette = loadPal(state.paletteId);
    const time = Date.now();
    const colorIndex = 0xF9 + Math.floor((time / 100) % 6); // 249-254 颜色依次循环
    const highlightColor = palette[colorIndex] & 0x00FFFFFF;
    const normalColor = 0xD4D0C0;

    // 步骤 3：逐行渲染当前商店商品名称和价格
    for (let i = 0; i < this.storeItems.length; i++) {
      const itemId = this.storeItems[i];
      const itemConfig = state.items[itemId];
      if (!itemConfig) continue;

      const isSelected = (this.selectedIndex === i && !this.confirming);
      const color = isSelected ? highlightColor : normalColor;

      // 绘制商品名称
      UI.drawWord(itemId, 150, 23 + i * 18, color);

      // 绘制商品价格
      UI.drawNum(itemConfig.gold, 285, 23 + i * 18, 'yellow');
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
    UI.drawArea(20, 100, 5, 1, 1);
    UI.drawWord(35, 28, 108, normalColor);

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
    UI.drawNum(count, 114, 108, 'yellow');

    // 步骤 6：绘制左侧“金钱”及金额框 (金钱短语 ID: 15)
    UI.drawArea(20, 141, 5, 1, 1);
    UI.drawWord(15, 28, 149, normalColor);
    UI.drawNum(state.money, 114, 149, 'yellow');

    // 步骤 7：若处于确认弹窗状态下，渲染“否/是”选择小框 (否 ID: 19, 是 ID: 20)
    if (this.confirming) {
      const yesNoColor = (val) => (this.confirmValue === val) ? highlightColor : normalColor;

      // 绘制“否”按钮
      UI.drawArea(130, 100, 2, 1, 1);
      UI.drawWord(19, 145, 108, yesNoColor(0));

      // 绘制“是”按钮
      UI.drawArea(205, 100, 2, 1, 1);
      UI.drawWord(20, 220, 108, yesNoColor(1));
    }
  },

  onInput(input) {
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
          this.draw();
          break;
        }
        case 'down': {
          this.selectedIndex = (this.selectedIndex + 1) % this.storeItems.length;
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
          // 退出商店，隐藏系统层 Canvas 并还原游戏模式与脚本步进
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

    state.currentMode = 'game';

    if (this.resolve) {
      this.resolve();
      this.resolve = null;
    }
  }
};
