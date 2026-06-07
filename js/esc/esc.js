import { state } from '../engine/state.js';
import { loadFbp, loadPic } from '../resources/pal.js';
import { UI, PanelFactory } from '../ui/panel.js';
import { Script } from '../engine/script.js';
import { toggleScene, setRolePos } from '../engine/command.js';
import { update } from '../ui/draw.js';
import { loadArchive, saveArchive } from './archive.js';

export const ESC = {
  ShowStatus: false,
  showRole: false,
  showItem: false,
  showMenu: false,

  // 菜单管理栈，包含当前所有激活的菜单层级
  menuStack: [],

  pushMenu(name, panel, renderFn, onInputFn) {
    this.menuStack.push({ name, panel, render: renderFn, onInput: onInputFn });
    this.renderAll();
  },

  popMenu() {
    this.menuStack.pop();
    if (this.menuStack.length === 0) {
      this.clearMenus();
    } else {
      this.renderAll();
    }
  },

  clearMenus() {
    this.menuStack = [];
    this.hideMenuCanvas();
    state.currentMode = 'game'; // 恢复为游戏正常探索行走状态
  },

  renderAll() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;
    
    // 步骤 1：清空当前启动/系统菜单画布以准备重绘
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    // 步骤 2：自底向上依次渲染菜单栈中的全部活跃菜单界面
    for (let i = 0; i < this.menuStack.length; i++) {
      const menu = this.menuStack[i];
      if (menu.render) {
        menu.render();
      }
    }
  },

  // 接收分发自 input.js 的标准化键盘/触屏输入
  onInput(input) {
    // 步骤 1：若按下 ESC，根据设计直接关闭所有菜单退回游戏，不需要逐级 pop
    if (input === 'ESC') {
      this.clearMenus();
      return;
    }

    if (this.menuStack.length === 0) return;

    // 步骤 2：转发给栈顶活跃菜单的对应输入接口
    const activeMenu = this.menuStack[this.menuStack.length - 1];
    if (activeMenu.onInput) {
      activeMenu.onInput(input);
    } else if (activeMenu.panel) {
      activeMenu.panel.onInput(input);
    }
  },

  // 展现 ESC 菜单画布，不使用任何挂起 Promise
  showMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
  },

  // 隐藏 ESC 菜单画布
  hideMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }
  },

  onStatus() {
    const fbp = loadFbp(0);
    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (startupCtx && fbp) {
        startupCtx.drawImage(fbp, 0, 0);
      }
    };

    const onInputFn = (input) => {
      // 状态栏展示时，按 E 键、S 键、空格或回车均可退回主菜单
      if (input === 'e' || input === 's' || input === 'blank') {
        ESC.popMenu();
      }
    };

    ESC.showMenuCanvas();
    state.currentMode = 'esc';
    ESC.pushMenu('status', null, renderFn, onInputFn);
  },

  onStartup() {
    state.currentMode = 'startup';
    ESC.showMenuCanvas();

    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    const fbpId = 0x3C;
    const fbp = loadFbp(fbpId);

    const startupPanel = PanelFactory.createList([7, 8])
      .canClose(false);
    startupPanel.x = 124;
    startupPanel.y = 96;

    const renderFn = () => {
      if (fbp) {
        startupCtx.drawImage(fbp, 0, 0);
      }
      startupPanel.draw();
    };

    startupPanel.onchange(() => {
      startNewStory();
    });

    ESC.pushMenu('startup', startupPanel, renderFn);

    document.addEventListener('touchend', function touchHandler(ev) {
      ev.preventDefault();
      newStory();

      const el = document.getElementById('startup');
      if (el) {
        animHide(el);
      }
      document.removeEventListener('touchend', touchHandler);
    });
  },

  onMenu() {
    ESC.showMenuCanvas();
    state.currentMode = 'esc';
    ESC.menuStack = [];

    const mainPanel = PanelFactory.createList([3, 4, 5, 6]);
    mainPanel.x = 2;
    mainPanel.y = 36;

    const renderFn = () => {
      UI.drawLabel(0, 0, 5);
      UI.drawWord(0x15, 10, 8, 0x000000); // 绘制金钱文本标签
      UI.drawNum(state.money || 0, 85, 15); // 动态展示运行时金钱
      mainPanel.draw();
    };

    mainPanel.onchange((value) => {
      switch (value) {
        case 3:
          ESC.onStatus();
          break;
        case 4:
          ESC.onMagic();
          break;
        case 5:
          ESC.onItem();
          break;
        case 6:
          ESC.onSystem();
          break;
      }
    }).oncancel(() => {
      ESC.clearMenus();
    });

    ESC.pushMenu('main', mainPanel, renderFn);
  },

  onItem() {
    const itemPanel = PanelFactory.createList([22, 23]);
    itemPanel.x = 28;
    itemPanel.y = 60;

    const renderFn = () => {
      itemPanel.draw();
    };

    itemPanel.onchange((value) => {
      switch (value) {
        case 22:
          ESC.onEquipItem();
          break;
        case 23:
          ESC.onUseItem();
          break;
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('item', itemPanel, renderFn);
  },

  onUseItem() {
    if (!state.ownItems || state.ownItems.length === 0) {
      state.ownItems = [99];
    }

    const useItemPanel = PanelFactory.createTable(state.ownItems);
    useItemPanel.skin(10).size(18, 8);
    useItemPanel.x = 2;
    useItemPanel.y = 32;

    const renderFn = () => {
      useItemPanel.draw();
    };

    useItemPanel.onchange((value) => {
      Script.startItemScript(state.items[value]);
      ESC.clearMenus();
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('useItem', useItemPanel, renderFn);
  },

  onEquipItem() {},

  onMagic() {},

  onSystem() {
    const systemPanel = PanelFactory.createList([11, 12, 13, 14, 15]);
    systemPanel.x = 28;
    systemPanel.y = 72;

    const renderFn = () => {
      systemPanel.draw();
    };

    systemPanel.onchange((value) => {
      switch (value) {
        case 11:
          ESC.onSaveGameMenu();
          break;
        case 12:
          ESC.onLoadGameMenu();
          break;
        case 13:
          console.log('系统设置 - 音乐选项选中');
          ESC.clearMenus();
          break;
        case 14:
          console.log('系统设置 - 音效选项选中');
          ESC.clearMenus();
          break;
        case 15:
          console.log('系统设置 - 结束游戏选项选中');
          ESC.clearMenus();
          break;
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('system', systemPanel, renderFn);
  },

  onSaveGameMenu() {
    const savePanel = PanelFactory.createList([43, 44, 45, 46, 47]);
    savePanel.x = 54;
    savePanel.y = 90;

    const renderFn = () => {
      savePanel.draw();
    };

    savePanel.onchange((value) => {
      let slotId = 1;
      if (value === 43 || value === 0x43) slotId = 1;
      else if (value === 44 || value === 0x44) slotId = 2;
      else if (value === 45 || value === 0x45) slotId = 3;
      else if (value === 46 || value === 0x46) slotId = 4;
      else if (value === 47 || value === 0x47) slotId = 5;

      saveArchive(slotId);
      ESC.clearMenus();
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('saveGame', savePanel, renderFn);
  },

  onLoadGameMenu() {
    const loadPanel = PanelFactory.createList([43, 44, 45, 46, 47]);
    loadPanel.x = 54;
    loadPanel.y = 90;

    const renderFn = () => {
      loadPanel.draw();
    };

    loadPanel.onchange((value) => {
      let slotId = 1;
      if (value === 43 || value === 0x43) slotId = 1;
      else if (value === 44 || value === 0x44) slotId = 2;
      else if (value === 45 || value === 0x45) slotId = 3;
      else if (value === 46 || value === 0x46) slotId = 4;
      else if (value === 47 || value === 0x47) slotId = 5;

      loadArchive(slotId, () => {
        setRolePos(state.mx, state.my, state.mhalf);
        update(true);
        ESC.clearMenus();
      });
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('loadGame', loadPanel, renderFn);
  }
};

function startNewStory() {
  ESC.menuStack = []; // 清空菜单栈，防止在淡出过渡期间重复按键触发
  const el = document.getElementById('startup');
  if (el) {
    animHide(el, () => {
      newStory();
    });
  }
}

function animHide(el, callback) {
  el.style.cssText = 'transition: all 1.0s linear';
  el.style.opacity = 1;
  el.style.opacity = 0;
  setTimeout(() => {
    ESC.hideMenuCanvas();
    el.style.opacity = 1;
    if (callback) callback();
  }, 1200);
}

function newStory() {
  state.currentMode = 'game'; // 激活常规游戏行走模式
  toggleScene(1);
  state.isPaused = false;
}
