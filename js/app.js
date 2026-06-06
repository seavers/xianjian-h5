import { state } from './engine/state.js';
import { ready, file_caches } from './resources/loader.js';
import { loadSss, loadDat, fromCache, caches } from './resources/pal.js';
import { setRolePos, setRoleTile, setRoleIndex, setRoleGroup, toggleScene, calcMap } from './engine/command.js';
import { ESC } from './esc/esc.js';
import { Hex } from './utils/hex.js';
import { Talk } from './ui/talk.js';
import { Script } from './engine/script.js';
import { updateCount, update as updateGameScreen } from './ui/draw.js';
import { loadArchive } from './esc/archive.js';
import './ui/input.js';
import { sleep } from './utils/timer.js';

// 获取 URL 参数是否为 debug 模式
const DEBUG = location.search && location.search.indexOf('debug') !== -1;
export let TICK_TIME = 80;  // 游戏主循环的 Tick 延时时间，默认 6 fps 对应 150ms
export let lastMainLoopTime = -1;

function initEventObject() {
  const sssId = 0;
  const data = loadSss(sssId);
  const view = data.toDataView();

  state.eventObjects[0] = null;

  const num = data.length / 32; // 每个 32 字节
  for (let i = 0; i < num; i++) {
    const obj = {
      type: 'npc',
      id: i + 1, // base 1
      nouse: view.nextShort(),
      x: view.nextShort(),
      y: view.nextShort(),
      layer: view.nextShort(),
      trigScr: view.nextShort(),
      autoScr: view.nextShort(),
      state: view.nextShort(),
      trigMode: view.nextShort(),
      mgoId: view.nextShort(),
      frameWalkCount: view.nextShort(),
      dir: view.nextShort(),
      frame: view.nextShort(),
      idleFrame: view.nextShort(),
      ptrOffset: view.nextShort(),
      frameAutoCount: view.nextShort(),
      idleFrameCountAuto: view.nextShort(),
    };
    state.eventObjects[i + 1] = obj;
  }
  console.log(`载入 NPC 事件物体 ${state.eventObjects.length - 1} 个`);
}

function initScript() {
  const sssId = 4;
  const data = loadSss(sssId);
  const view = data.toDataView();

  const num = data.length / 8; // 每个 8 字节
  for (let i = 0; i < num; i++) {
    const script = {
      id: i,
      code: view.nextShort(),
      param1: view.nextShort(),
      param2: view.nextShort(),
      param3: view.nextShort()
    };
    state.scripts.push(script);
  }
  console.log(`载入游戏脚本指令 ${state.scripts.length} 条`);
}

function initScene() {
  const sssId = 1;
  const data = loadSss(sssId);

  state.scenes[0] = null;
  const num = data.length / 8;
  for (let i = 0; i < num; i++) {
    state.scenes[i + 1] = {
      sceneId: i + 1,
      mapId: data.getShort(i * 8 + 0),
      enterScriptId: data.getShort(i * 8 + 2),
      exitScriptId: data.getShort(i * 8 + 4),
      startEventId: data.getShort(i * 8 + 6),
      endEventId: data.getShort(i * 8 + 8 + 6)
    };
  }
  console.log(`载入地图场景 ${state.scenes.length - 1} 个`);
}

function initItem() {
  const sssId = 2;
  const data = loadSss(sssId);

  const num = data.length / 12; // 每个 12 字节
  for (let i = 0; i < num; i++) {
    const item = {
      id: i,
      roleId: data.getShort(i * 12 + 0),
      gold: data.getShort(i * 12 + 2),
      useScr: data.getShort(i * 12 + 4),
      equScr: data.getShort(i * 12 + 6),
      dropScr: data.getShort(i * 12 + 8),
      flags: data.getShort(i * 12 + 10)
    };
    state.items.push(item);
  }
  console.log(`载入包裹道具表 ${state.items.length} 件`);
}

function initDat() {
  const data = loadDat();

  const num = data.length / 10; // 每个 10 字节
  for (let i = 0; i < num; i++) {
    const d = data.slice(i * 10, i * 10 + 10);
    state.words.push(d);
  }
  console.log(`载入简体汉字短语字表完成`);
}

// 绑定全局上下文，挂载至 state
function initContexts() {
  state.contexts.main = document.getElementById('canvas').getContext('2d');
  state.contexts.back = document.getElementById('back').getContext('2d');
  state.contexts.talk = document.getElementById('talk').getContext('2d');
  state.contexts.startup = document.getElementById('startup').getContext('2d');
  
  // 遍历所有 2D 上下文，在引擎底层彻底关闭图像平滑（Image Smoothing），确保复制及渲染极致清晰锐利
  Object.values(state.contexts).forEach(ctx => {
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
    }
  });

  // 注入全局简便转换函数
  window.hex = Hex.toHex2;
  window.toHex = Hex.toHex2;
  window.toHex4 = Hex.toHex4;
  window.Talk = Talk;

  // 1. 挂载渲染计数器、定时器时钟及资源缓存至全局 window 作用域，便于右侧面板实时监控分析
  window.updateCount = updateCount;
  window.updateGameScreen = updateGameScreen;
  window.file_caches = file_caches;
  window.pal_caches = caches;
}

// 资源载入并启动
ready(() => {
  // 隐藏等待 info 的 DOM 列表
  const infoEl = document.getElementById('info');
  if (infoEl) {
    infoEl.style.display = 'none';
  }

  // 初始化 Context 和游戏数据表
  initContexts();
  initEventObject();
  initScript();
  initScene();
  initItem();
  initDat();

  // 挂载调试接口至 window 供右侧监视器一键操控
  window.state = state;
  window.toggleScene = toggleScene;
  window.setRolePos = setRolePos;

  if (!DEBUG) {
    state.currentMode = 'startup';
    ESC.onStartup();
  } else {
    state.currentMode = 'game';

    // 步骤 1：挂起主循环，防止读档完成前主逻辑提前步进
    state.isPaused = true;

    commonEnter();

    // 步骤 2：解析 URL 中的 debug 参数作为存档 ID
    const debugParam = new URLSearchParams(location.search).get('debug');
    const slotId = parseInt(debugParam) || 1;

    // 步骤 3：调用 loadArchive 从 localStorage 或服务器读取载入对应存档进度
    let loaded = false;
    loadArchive(slotId, () => {
      loaded = true;
      
      // 步骤 4：载入成功后，设定主角绝对瓦片坐标并重新计算视口位置
      setRolePos(state.mx, state.my, state.mhalf);
      updateGameScreen(true);
      
      // 步骤 5：恢复主逻辑循环运行
      state.isPaused = false;
      console.log(`[Debug] 成功从 localStorage/服务器 载入存档 ID: ${slotId}，进入场景: ${state.sceneId}`);
    });

    // 步骤 6：设置安全延时保护，若 2 秒内读取未响应则自动降级进入默认初始场景，避免黑屏挂起
    setTimeout(() => {
      if (!loaded) {
        console.warn(`[Debug] 载入存档 ID: ${slotId} 超时或失败，降级切换至默认场景`);
        setRolePos(49, 94, 0);
        toggleScene(1);
        state.isPaused = false;
      }
    }, 2000);
  }

  // 5. 资源就绪及初始化完毕后，正式开启主循环
  setTimeout(executeMainLoop, 1);
});

// setInterval 驱动的主循环，[TICK_TIME」ms 周期执行一次
async function executeMainLoop() {
  try {
    let loopIndex = 0;
    while(true) {
      // console.log(++loopIndex, '执行主循环')
      const start = Date.now();
      await Script.mainLoop();
      const end = Date.now();
      lastMainLoopTime = end - start;
      // console.log('执行一次主循环，' + lastMainLoopTime + 'ms');

      if (end - start > TICK_TIME) {
        await sleep(1);
      } else {
        await sleep(TICK_TIME - lastMainLoopTime);
      }
    }
  } catch (e) {
    alert('游戏异常: ' + e.message);
    throw e;
  }
}

function commonEnter() {
  setRoleTile(0, 0x2, 0);     // 李逍遥动作形象
  setRoleGroup(1);           // 队伍配置
}

export function setTickTime(newTickTime) {
  // 步骤 1：同步更新全局的 TICK_TIME 变量值，使得后续的 setTimeout 延时及主循环延时全部生效
  TICK_TIME = newTickTime;
}