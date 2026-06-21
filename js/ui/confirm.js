import { state } from '../engine/state.js';
import { loadPal } from '../resources/pal.js';
import { UI } from './panel.js';
import { update } from './draw.js';

export const Confirm = {
  confirmValue: 0, // 0: 否, 1: 是
  resolve: null,
  timer: null,

  async open() {
    this.confirmValue = 0; // 默认选中 否

    // 步骤 1：同步重绘底图以生成静态底图，防止画面变黑
    update(true);

    // 步骤 2：切换当前运行模式至 'confirm' 并将交互 Canvas 层显示出来
    state.currentMode = 'confirm';
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

  draw() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    // 步骤 1：同步重绘底层场景和人物精灵
    update(true);

    // 步骤 2：清空当前交互 Canvas 层的画面
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    // 步骤 3：获取全局调色板以实现闪烁高亮配色
    const palette = loadPal(state.paletteId);
    const time = Date.now();
    const colorIndex = 0xF9 + Math.floor((time / 100) % 6);
    const highlightColor = palette[colorIndex] & 0x00FFFFFF;

    const yesNoColor = (val) => (this.confirmValue === val) ? highlightColor : 0x000000;

    // 步骤 4：绘制“否”按钮小框，文字居中 (否：word.dat #19)
    UI.drawLabel(130, 100, 2);
    UI.drawWord(19, 136, 109, yesNoColor(0));

    // 步骤 5：绘制“是”按钮小框，文字居中 (是：word.dat #20)
    UI.drawLabel(200, 100, 2);
    UI.drawWord(20, 211, 109, yesNoColor(1));
  },

  onInput(input) {
    switch (input) {
      case 'left':
      case 'right': {
        // 步骤 1：按左右方向键在是/否之间切换
        this.confirmValue = (this.confirmValue === 0) ? 1 : 0;
        this.draw();
        break;
      }
      case 'blank': {
        // 步骤 2：按空格/回车确认当前选项
        this.close(this.confirmValue === 1);
        break;
      }
      case 'ESC':
      case 'e': {
        // 步骤 3：按取消/退出键，视为选择“否”
        this.close(false);
        break;
      }
    }
  },

  close(result) {
    // 步骤 1：停止闪烁绘制定时器并隐藏 Canvas 交互层
    this.stopDrawLoop();
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }

    // 步骤 2：切回常规游戏运行模式并 resolve Promise
    state.currentMode = 'game';

    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }
};
