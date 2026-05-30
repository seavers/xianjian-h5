import { state } from './engine/state.js';
import { ready, file_caches } from './resources/loader.js';
import { loadSss, loadDat, fromCache, caches } from './resources/pal.js';
import { setRolePos, setRoleTile, setRoleIndex, setRoleGroup, toggleScene, calcMap } from './engine/command.js';
import { ESC } from './esc/esc.js';
import { Hex } from './utils/hex.js';
import { Talk } from './ui/talk.js';
import { Script } from './engine/script.js';
import { Timer } from './engine/timer.js';
import { updateCount, update as updateGameScreen } from './ui/draw.js';

// 获取 URL 参数是否为 debug 模式
const DEBUG = location.search && location.search.indexOf('debug') !== -1;

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
      frame: view.nextShort(),
      dir: view.nextShort(),
      unknown1: view.nextShort(),
      unknown2: view.nextShort(),
      modsRef: view.nextShort(),
      unknown3: view.nextShort(),
      unknown4: view.nextShort()
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
  state.contexts.map = document.getElementById('map').getContext('2d');
  state.contexts.front = document.getElementById('front').getContext('2d');
  state.contexts.temp = document.getElementById('temp').getContext('2d');
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
  window.Timer = Timer;
  window.file_caches = file_caches;
  window.caches = caches;
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
    ESC.onStartup();
  } else {
    commonEnter();

    // 1. 获取 URL 中的 debug 参数作为 COORDS 数组的下标
    const n = +new URLSearchParams(location.search).get('debug') || 0;

    // 2. 默认的坐标配置数组，与 index.html 保持一致
    const DEFAULT_COORDS = [
      { sceneId: 1, x: 49, y: 94, name: '逍遥卧室' },
      { sceneId: 2, x: 26, y: 36, name: '客栈一楼' },
      { sceneId: 3, x: 42, y: 18, name: '大娘病房' },
      { sceneId: 4, x: 54, y: 87, name: '盛渔村集市' },
      { sceneId: 5, x: 30, y: 30, name: '仙灵岛荷花池' },
      { sceneId: 6, x: 20, y: 20, name: '仙灵岛水月宫' }
    ];

    // 3. 从 localStorage 加载配置，如果没有，使用默认值
    let coords = DEFAULT_COORDS;
    try {
      const saved = localStorage.getItem('PAL_COORDS');
      if (saved) {
        coords = JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载传送坐标配置失败，使用默认值', e);
    }

    // 4. 获取目标传送坐标并执行场景切换
    const target = coords[n] || coords[0];
    if (target) {
      setRolePos(target.x, target.y, 0);
      toggleScene(target.sceneId);
    }
  }

  // 5. 资源就绪及初始化完毕后，正式开启 requestAnimationFrame 驱动的主循环
  function runLoop(timestamp) {
    Script.mainLoop(timestamp);
    requestAnimationFrame(runLoop);
  }
  requestAnimationFrame(runLoop);
});

function commonEnter() {
  setRoleTile(0, 0x2, 0);     // 李逍遥动作形象
  setRoleGroup(1);           // 队伍配置
}
