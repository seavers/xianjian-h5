import { state } from '../engine/state.js';
import { loadPal } from '../resources/pal.js';
import { UI } from './panel.js';
import { update } from './draw.js';

let previousUiMode = 'operate';

export const SelectRole = {
  selectedIndex: 0,
  resolve: null,
  timer: null,

  async open() {
    this.selectedIndex = 0;

    // 步骤 1：同步重绘底图以生成静态底图，防止画面变黑
    update(true);

    // 步骤 2：切换当前交互状态至 'selectRole' 并将交互 Canvas 层显示出来
    previousUiMode = state.uiMode;
    state.uiMode = 'selectRole';
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

    // 步骤 4：在屏幕中央绘制红木纹卷卷框，自适应队伍角色数量
    const partyCount = state.party ? state.party.length : 0;
    if (partyCount === 0) return;

    // 绘制一个样式为 1 的选择框
    UI.drawModalBox(110, 50, 4, partyCount);

    // 步骤 5：绘制队伍各成员的名字，高亮当前选中的名字
    for (let i = 0; i < partyCount; i++) {
      const pRole = state.party[i];
      if (!pRole) continue;
      const roleDetail = state.roles[pRole.index];
      if (!roleDetail) continue;
      const nameId = roleDetail.nameId;
      const isSelected = (i === this.selectedIndex);
      const color = isSelected ? highlightColor : 0x000000;
      UI.drawWord(nameId, 125, 63 + i * 18, color);
    }
  },

  onInput(input) {
    const partyCount = state.party ? state.party.length : 0;
    if (partyCount === 0) return;

    switch (input) {
      case 'up': {
        this.selectedIndex = (this.selectedIndex - 1 + partyCount) % partyCount;
        this.draw();
        break;
      }
      case 'down': {
        this.selectedIndex = (this.selectedIndex + 1) % partyCount;
        this.draw();
        break;
      }
      case 'blank': {
        // 步骤 1：确认选中，返回队伍成员索引
        this.close(this.selectedIndex);
        break;
      }
      case 'ESC':
      case 'e': {
        // 步骤 2：取消，返回 -1
        this.close(-1);
        break;
      }
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
