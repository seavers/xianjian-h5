import { state } from '../engine/state.js';
import { loadFbp, loadPic, loadBall } from '../resources/pal.js';
import { UI, PanelFactory } from '../ui/panel.js';
import { unbind } from '../ui/input.js';
import { Script } from '../engine/script.js';
import { toggleScene } from '../engine/command.js';

export const ESC = {
  ShowStatus: false,
  showRole: false,
  showItem: false,
  showMenu: false,

  onESC() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;
    const fbp = loadFbp(0);
    if (fbp) {
      startupCtx.drawImage(fbp, 0, 0);
    }
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
  },

  onStatus() {
    const startupCanvas = document.getElementById('startup');
    if (!startupCanvas) return;

    if (ESC.ShowStatus) {
      startupCanvas.style.display = 'none';
    } else {
      const startupCtx = state.contexts.startup;
      if (startupCtx) {
        const fbp = loadFbp(0);
        if (fbp) {
          startupCtx.drawImage(fbp, 0, 0);
        }
      }
      startupCanvas.style.display = 'block';
    }
    ESC.ShowStatus = !ESC.ShowStatus;
  },

  onRole() {
    const startupCanvas = document.getElementById('startup');
    if (!startupCanvas) return;

    if (ESC.showRole) {
      startupCanvas.style.display = 'none';
    } else {
      // 预留角色显示绘制
    }
    ESC.showRole = !ESC.showRole;
  },

  onStartup() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    const fbpId = 0x3C;
    const fbp = loadFbp(fbpId);
    if (fbp) {
      startupCtx.drawImage(fbp, 0, 0);
    }

    PanelFactory.createList([7, 8])
      .canClose(false)
      .show(124, 96)
      .onchange((value) => {
        startNewStory();
        unbind();
      });

    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }

    document.addEventListener('touchend', function touchHandler(ev) {
      ev.preventDefault();
      newStory();

      const el = document.getElementById('startup');
      if (el) {
        el.style.display = 'none';
        animHide(el);
      }
      document.removeEventListener('touchend', touchHandler);
    });
  },

  onMenu() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    UI.drawLabel(0, 0, 5);
    UI.drawWord(0x15, 10, 8, 0x000000); // 绘制金钱文本标签
    UI.drawNum(state.money || 0, 85, 15); // 动态展示运行时金钱！

    PanelFactory.createList([3, 4, 5, 6])
      .show(2, 36)
      .onchange((value) => {
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
      });

    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
  },

  onItem() {
    PanelFactory.createList([22,23])
      .show(28, 60)
      .onchange((value) => {
        switch (value) {
          case 22:
            ESC.onEquipItem();
            break;
            case 23:
            ESC.onUseItem();
            break;
        }
      });

  },

  onUseItem() {
    // 默认如果无物品，给予桂花酒作为初始体验
    if (!state.ownItems || state.ownItems.length === 0) {
      state.ownItems = [99];
    }

    PanelFactory.createTable(state.ownItems)
      .skin(10)
      .size(18, 8)
      .show(2, 32)
      .onchange((value) => {
        Script.startItemScript(state.items[value]);
        const startupCanvas = document.getElementById('startup');
        if (startupCanvas) {
          startupCanvas.style.display = 'none';
        }
      });

    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
  },

  onEquipItem() {},

  onMagic() {},
  onSystem() {}
};

function startNewStory() {
  const el = document.getElementById('startup');
  if (el) {
    el.style.display = 'none';
    animHide(el);
  }
  newStory();
}

function animHide(el, callback) {
  el.style.cssText = 'transition: all 1.0s linear';
  el.style.opacity = 1;
  el.style.opacity = 0;
  setTimeout(() => {
    el.style.display = 'none';
    el.style.opacity = 1;
    if (callback) callback();
  }, 1200);
}

function newStory() {
  toggleScene(1);
}
