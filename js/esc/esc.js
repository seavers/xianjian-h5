import { state } from '../engine/state.js';
import { loadFbp, loadPic, loadBall } from '../resources/pal.js';
import { UI, PanelFactory } from '../ui/panel.js';
import { unbind } from '../ui/input.js';
import { Script } from '../engine/script.js';
import { toggleScene, setRolePos } from '../engine/command.js';
import { drawMapAll, update } from '../ui/draw.js';
import { Lang } from '../utils/lang.js';

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
        // 步骤 2：对选中的读档槽位换算出具体对应的存档槽位号（1 - 5）
        let slotId = 1;
        if (value === 43 || value === 0x43) slotId = 1;
        else if (value === 44 || value === 0x44) slotId = 2;
        else if (value === 45 || value === 0x45) slotId = 3;
        else if (value === 46 || value === 0x46) slotId = 4;
        else if (value === 47 || value === 0x47) slotId = 5;

        const filename = `${slotId}.RPG`;
        console.log(`正在从本地目录加载并解析进度文件: pal/${filename}`);

        // 步骤 3：网络异步读取进度文件，并在回调中进行内存二进制高精度流式解包与 state 全局还原
        Lang.ajaxByteArray(filename, (byteArray) => {
          if (!byteArray || byteArray.length === 0) {
            console.error(`无法成功读取文件: ${filename}`);
            return;
          }

          const view = byteArray.toDataView();

          // 步骤 4：解构头部 40 字节元数据，包含角色坐标、场景号和朝向等
          const wSavedTimes = view.nextShort();
          const wViewportX = view.nextShort();
          const wViewportY = view.nextShort();
          const nPartyMember = view.nextShort();
          const wNumScene = view.nextShort();
          const wPaletteOffset = view.nextShort();
          const wPartyDirection = view.nextShort();
          const wNumMusic = view.nextShort();
          const wNumBattleMusic = view.nextShort();
          const wNumBattleField = view.nextShort();
          const wScreenWave = view.nextShort();
          const wBattleSpeed = view.nextShort();
          const wCollectValue = view.nextShort();
          const wLayer = view.nextShort();
          const wChaseRange = view.nextShort();
          const wChasespeedChangeCycles = view.nextShort();
          const nFollower = view.nextShort();
          view.skipByte(6); // 跳过 rgwReserved2[3] 预留空间 (3 WORDs)

          // 步骤 5：读取资金，并跳过 rgParty, rgTrail, Exp, PlayerRoles, rgPoisonStatus
          const dwCash = view.nextInt();
          view.skipByte(50); // 跳过玩家队伍状态 (5 * 10B)
          view.skipByte(30); // 跳过移动路径痕迹 (5 * 6B)
          view.skipByte(384); // 跳过全员经验与成长 (8 * 6 * 8B)
          view.skipByte(900); // 跳过玩家角色配置 (75 * 6 * 2B)
          view.skipByte(320); // 跳过全员状态异常毒性 (16 * 5 * 4B)

          // 步骤 6：按 6 字节单位循环 256 次，读取非空 wItem 并重构背包道具 global.state.ownItems
          const ownItems = [];
          for (let i = 0; i < 256; i++) {
            const wItem = view.nextShort();
            const nAmount = view.nextShort();
            const nAmountInUse = view.nextShort();
            if (wItem !== 0) {
              for (let a = 0; a < nAmount; a++) {
                ownItems.push(wItem);
              }
            }
          }

          // 步骤 7：按 8 字节单位循环 300 次，重构全部场景配置，随后刷新 endEventId
          for (let i = 0; i < 300; i++) {
            const mapId = view.nextShort();
            const enterScriptId = view.nextShort();
            const exitScriptId = view.nextShort();
            const startEventId = view.nextShort();
            if (state.scenes[i + 1]) {
              state.scenes[i + 1].mapId = mapId;
              state.scenes[i + 1].enterScriptId = enterScriptId;
              state.scenes[i + 1].exitScriptId = exitScriptId;
              state.scenes[i + 1].startEventId = startEventId;
            }
          }
          for (let i = 1; i < 300; i++) {
            if (state.scenes[i] && state.scenes[i + 1]) {
              state.scenes[i].endEventId = state.scenes[i + 1].startEventId;
            }
          }

          // 步骤 8：按 12 字节单位循环 600 次，重构包揽所有物品/奇门遁甲特性的物品配置表
          for (let i = 0; i < 600; i++) {
            const roleId = view.nextShort();
            const gold = view.nextShort();
            const useScr = view.nextShort();
            const equScr = view.nextShort();
            const dropScr = view.nextShort();
            const flags = view.nextShort();
            if (state.items[i]) {
              state.items[i].roleId = roleId;
              state.items[i].gold = gold;
              state.items[i].useScr = useScr;
              state.items[i].equScr = equScr;
              state.items[i].dropScr = dropScr;
              state.items[i].flags = flags;
            }
          }

          // 步骤 9：按 32 字节解构并同步更新所有的 NPC 活动生命状态及自动运行脚本
          const remainingBytes = byteArray.length - view.index;
          const nEventObject = Math.floor(remainingBytes / 32);
          for (let i = 0; i < nEventObject; i++) {
            const sVanishTime = view.nextShort();
            const x = view.nextShort();
            const y = view.nextShort();
            const sLayer = view.nextShort();
            const wTriggerScript = view.nextShort();
            const wAutoScript = view.nextShort();
            const sState = view.nextShort();
            const wTriggerMode = view.nextShort();
            const wSpriteNum = view.nextShort();
            const nSpriteFrames = view.nextShort();
            const wDirection = view.nextShort();
            const wCurrentFrameNum = view.nextShort();
            const nScriptIdleFrame = view.nextShort();
            const wSpritePtrOffset = view.nextShort();
            const nSpriteFramesAuto = view.nextShort();
            const wScriptIdleFrameCountAuto = view.nextShort();

            if (state.eventObjects[i + 1]) {
              state.eventObjects[i + 1].nouse = sVanishTime;
              state.eventObjects[i + 1].x = x;
              state.eventObjects[i + 1].y = y;
              state.eventObjects[i + 1].layer = sLayer;
              state.eventObjects[i + 1].trigScr = wTriggerScript;
              state.eventObjects[i + 1].autoScr = wAutoScript;
              state.eventObjects[i + 1].state = sState;
              state.eventObjects[i + 1].trigMode = wTriggerMode;
              state.eventObjects[i + 1].mgoId = wSpriteNum;
              state.eventObjects[i + 1].frame = nSpriteFrames;
              state.eventObjects[i + 1].dir = wDirection;
              state.eventObjects[i + 1].unknown1 = wCurrentFrameNum;
              state.eventObjects[i + 1].unknown2 = nScriptIdleFrame;
              state.eventObjects[i + 1].modsRef = wSpritePtrOffset;
              state.eventObjects[i + 1].unknown3 = nSpriteFramesAuto;
              state.eventObjects[i + 1].unknown4 = wScriptIdleFrameCountAuto;
            }
          }

          // 步骤 10：将读档出来的具体参数同步回全局 state 状态机中
          state.money = dwCash;
          state.ownItems = ownItems;
          state.roles[0].x = wViewportX;
          state.roles[0].y = wViewportY;
          state.roles[0].dir = wPartyDirection;
          state.mapX = wViewportX;
          state.mapY = wViewportY;
          state.mx = Math.floor(wViewportX / 32);
          state.my = Math.floor(wViewportY / 16);
          state.mhalf = Math.round((wViewportX - state.mx * 32) / 16);
          state.sceneId = wNumScene;

          const scene = state.scenes[wNumScene];
          if (scene) {
            state.mapId = scene.mapId;
            state.startEventId = scene.startEventId;
            state.endEventId = scene.endEventId;
          }

          // 步骤 11：清屏隐藏菜单画布，并重绘刷新大地图及瓦片坐标，正式推进游戏主循环
          setRolePos(state.mx, state.my, state.mhalf);
          drawMapAll();
          update(true);
          ESC.hideMenuCanvas();

          console.log(`进度槽位 ${slotId} 读取并解析完成！场景号: ${wNumScene}, 坐标: (${state.mx}, ${state.my})`);
        });
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
