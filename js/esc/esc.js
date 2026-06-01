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

  pausePromise: null,
  resolvePause: null,

  // 步骤 1：展现 ESC 菜单画布，并同步创建全局的挂起 Promise，以便 mainLoop 头部 await 挂起逻辑帧
  showMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
    if (!this.pausePromise) {
      this.pausePromise = new Promise((resolve) => {
        this.resolvePause = resolve;
      });
    }
  },

  // 步骤 2：隐藏 ESC 菜单画布，并触发 Promise resolve 以唤醒被阻塞暂停的主逻辑循环
  hideMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }
    if (this.resolvePause) {
      this.resolvePause();
      this.resolvePause = null;
      this.pausePromise = null;
    }
  },

  onESC() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;
    const fbp = loadFbp(0);
    if (fbp) {
      startupCtx.drawImage(fbp, 0, 0);
    }
    ESC.showMenuCanvas();
  },

  onStatus() {
    if (ESC.ShowStatus) {
      ESC.hideMenuCanvas();
    } else {
      const startupCtx = state.contexts.startup;
      if (startupCtx) {
        const fbp = loadFbp(0);
        if (fbp) {
          startupCtx.drawImage(fbp, 0, 0);
        }
      }
      ESC.showMenuCanvas();
    }
    ESC.ShowStatus = !ESC.ShowStatus;
  },

  onRole() {
    if (ESC.showRole) {
      ESC.hideMenuCanvas();
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

    ESC.showMenuCanvas();

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

    ESC.showMenuCanvas();
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
        ESC.hideMenuCanvas();
      });

    ESC.showMenuCanvas();
  },

  onEquipItem() {},

  onMagic() {},

  onSystem() {
    // 步骤 1：创建并展示系统二级菜单，包含存储进度、读取进度、音乐、音效和结束游戏选项
    PanelFactory.createList([11, 12, 13, 14, 15])
      .show(28, 72)
      .onchange((value) => {
        // 步骤 2：根据用户确认选择的子项进行相应逻辑分发
        switch (value) {
          case 11:
            ESC.onSaveGameMenu();
            break;

          case 12:
            ESC.onLoadGameMenu();
            break;

          case 13:
            console.log('系统设置 - 音乐选项选中');
            ESC.hideMenuCanvas();
            break;

          case 14:
            console.log('系统设置 - 音效选项选中');
            ESC.hideMenuCanvas();
            break;

          case 15:
            console.log('系统设置 - 结束游戏选项选中');
            ESC.hideMenuCanvas();
            break;
        }
      });
  },

  onSaveGameMenu() {
    // 步骤 1：创建并展示存储进度的三级菜单，提供五个进度存档槽位
    PanelFactory.createList([43, 44, 45, 46, 47])
      .show(54, 90)
      .onchange((value) => {
        // 步骤 2：对选中的存档槽位执行进度保存逻辑，最后清屏隐藏菜单并解绑输入
        console.log('存储进度至进度槽位:', value);
        ESC.hideMenuCanvas();
      });
  },

  onLoadGameMenu() {
    // 步骤 1：创建并展示读取进度的三级菜单，提供五个进度读档槽位
    PanelFactory.createList([43, 44, 45, 46, 47])
      .show(54, 90)
      .onchange((value) => {
        // 步骤 2：对选中的读档槽位执行进度读取逻辑，最后清屏隐藏菜单并解绑输入
        console.log('从进度槽位读取进度:', value);
        ESC.hideMenuCanvas();
      });
  }
};

function startNewStory() {
  const el = document.getElementById('startup');
  if (el) {
    animHide(el);
  }
  newStory();
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
  state.isPaused = false; // 正式启动游戏主循环时钟暂停状态，激活核心 tick()
  toggleScene(1);
}
