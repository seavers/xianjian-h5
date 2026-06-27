import { state } from './state.js';
import { scriptCodes, performToggleScene } from './command.js';
import { Hex } from '../utils/hex.js';
import { update } from '../ui/draw.js';
import { fadeIn, fadeOut } from '../ui/fade.js';

export const RESET_SCRIPT = -1;   //返回最初的入口，下次触发从上次入口重新执行
export const CIRCLE_SCRIPT = -2;  //返回当前的入口，下次循环从当前入口再次执行
export const REPLACE_ENTRY = -3;  //将当前的入口替换为下一个脚本
export const GOTO_SCRIPT = 'GOTO_SCRIPT';    //将当前的入口替换为下一个脚本

export const Script = {

  activeThread: null,
  nextThreads: [],

  startScene(scene) {
    Script.start(scene.enterScriptId, scene, 'scene');
  },

  startTrigScript(obj) {
    Script.start(obj.trigScr, obj, 'trig');
  },

  startItemScript(obj) {
    Script.start(obj.useScr, obj, 'item');
  },

  // 启动并注册脚本线程状态
  start(scriptId, obj, type) {
    Script.nextThreads.push({scriptId, obj, type})
  },

  // 1. 「TICK_TIME」ms 周期性调用的游戏主循环入口
  async mainLoop() {
    await Script.tick();
  },

  // 4. 规范化的逻辑帧嘀嗒（负责原本单次游戏循环中的全部逻辑更新与统一渲染）
  async tick() {
    // 步骤 1.8：如果当前正处于对话模式，根据是否等待按键挂起更新闪烁箭头，并直接挂起逻辑帧
    if (state.uiMode === 'talk') {
      if (window.Talk && window.Talk.isWaiting) {
        window.Talk.tickArrow();
      }
      return;
    }

    // 步骤 1.5：其他非常规探索模式一律挂起逻辑帧
    if (state.currentMode !== 'game' || state.uiMode !== 'operate') {
      return;
    }

    // 步骤3：一直遍历加载执行所有的主动式脚本
    await Script.checkAndExecuteScript();

    // 步骤 4.5：更新所有事件物体的 sVanishTime (即 nouse)
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (o && o.nouse !== 0) {
        o.nouse += (o.nouse < 0 ? 1 : -1);
      }
    }

    // 步骤 6：步进 auto NPC 漫游并统一重绘刷新
    await this.stepAutoAndUpdate();

    if(window.onSceneUpdate) {
      window.onSceneUpdate();
    }
  },

  async checkAndExecuteScript() {
    while(true) {
      if (Script.nextThreads?.length) {
        const thread = Script.nextThreads.shift();
        await this.executeScript(thread);
        continue;
      }

      // 步骤 1：检测是否需要进行场景切换（一律在主循环头部做同步判定）
      // 这里不能判定 state.nextSceneId !== state.sceneId 因为有些场景会切换到同一个sceneId，比如水井下的地图切换脚本17454
      if (state.nextSceneId !== -1) {
        await this.handleSceneSwitch();
        state.nextSceneId = -1;
        continue;
      }

      // 步骤 4：检测是否有延迟触发的 trigger 交互脚本需要激活
      if (state.nextTriggerScriptObject != null) {
        const obj = state.nextTriggerScriptObject;
        const scriptId = obj.trigScr;
        
        // 重置延迟触发器状态
        state.nextTriggerScriptObject = null;
        
        Script.start(scriptId, obj, 'trig');
        // 激活后继续向下运行，以便在同一个 tick 中直接步进该脚本，保持高响应性
        continue;
      }
      break;
    }
  },

  async executeScript(thread) {
    // 步骤 5：步进当前活跃的非 auto 类主线程（进入场景脚本、交互触发脚本等）
    const t = Script.activeThread = thread;
    if (t) {
      const nextId = await this.runTriggerScript(t.scriptId, t.obj, t.type);
      if (t.type === 'scene') {
        t.obj.enterScriptId = nextId;
      } else if (t.type === 'trig') {
        t.obj.trigScr = nextId;
      }

      // 如果当前主线程执行完毕（未被 subScript 子脚本切换或退栈），将其置空以安全出栈
      if (Script.activeThread === t) {
        Script.activeThread = null;
      }

      // 跳过这里，不update，不然切换场景ID+setRolePos后的update会丢失背景，见鬼阴山场景69切换脚本16975
      return;
    }
  },

  handleSceneSwitch() {
    const targetSceneId = state.nextSceneId;
    
    // 1. 重置挂起的切换标志，避免重复执行
    state.nextSceneId = -1;
    
    // 2. 这里不再执行淡入淡出，因为有些场景不fadeInOut，比如锁妖塔底关于赵灵儿的回忆，切换场景ID后是clearEffect过场，而不是fadeInOut
    performToggleScene(targetSceneId);
  },

  // 步进执行动画/步态进度。如果动画正在进行则返回剩余步数，全部执行完毕则返回 0
  stepProgress(obj, total, func) {
    const current = (obj.animStep || 0) + 1;
    if (func) func(current);

    if (current >= total) {
      obj.animStep = 0;
      return 0;
    }
    obj.animStep = current;

    // 返回剩余步数，以作为非零信号挂起指令
    return total - current;
  },

  isExec() {
    const t = Script.activeThread;
    return !!t;
  },

  sleep(time) {
    return Script.stepProgress(state.roles[0], time);
  },

  // 集中推进非 auto 类型的阻塞脚本主线程，运行 While 指令解析循环
  async runTriggerScript(startScriptId, obj, type) {
    let scriptEntry = startScriptId;
    
    let endFlag = false;
    while (!endFlag) {
      // 1. 核心单步调试拦截点
      if (window.STEP_DEBUG) {
        if (window.onStepDebugPause) {
          await window.onStepDebugPause(obj, scriptEntry);
        }
      }
      if(Script.activeThread) {
        Script.activeThread.scriptId = scriptEntry;
      }

      // 2. 读取当前指令
      const script = state.scripts[scriptEntry];
      if (!script) {
        console.warn(`脚本越界 ${scriptEntry}`);
        break;
      }

      const code = scriptCodes[script.code];
      const desc = code ? code.desc : '未知指令';

      // 生成当前对象的简短标识标签，角色→R1~R6，场景→#N，NPC→NXXX，物品→IXXX
      let objTag = '';
      if (obj) {
        if (obj.type === 'role') {
          objTag = `R${(obj.index || 0) + 1}`;
        } else if (type === 'scene') {
          objTag = `#${obj.sceneId || state.sceneId || '?'}`;
        } else if (type === 'item') {
          const itemIdx = state.items.indexOf(obj);
          objTag = itemIdx >= 0 ? `I${itemIdx}` : '';
        } else if (typeof obj.id === 'number') {
          objTag = `N${obj.id}`;
        }
      }

      // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
      const logItem = {
        npcId: obj ? obj.id : '无',
        roleId: obj && typeof obj.mgoId === 'number' ? obj.mgoId : null,
        type: type,
        objTag: objTag,
        scriptId: scriptEntry,
        code: script.code,
        hexCode: '0x' + Hex.toHex(script.code),
        desc: desc,
        param1: script.param1,
        param2: script.param2,
        param3: script.param3,
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now()
      };

      state.scriptLogs.push(logItem);
      if (state.scriptLogs.length > 40) {
        state.scriptLogs.shift();
      }

      if (window.onScriptExecute) {
        window.onScriptExecute(logItem);
      }

      if (!code) {
        console.warn(`[warn] [NPC ${obj?.id || '无'} scriptId:${scriptEntry}]: execute ${Hex.toHex(script.code)}`);
        scriptEntry++; // 未知指令跳过
        continue;
      }

      const tab = type.charAt(0).toUpperCase();
      console.log(`[info] [${tab} NPC:${obj?.id || '无'} IP:${scriptEntry}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

      if (!code.func) {
        // 指令还没有支持，跳过 
        return scriptEntry + 1;
      }

      let ret = -1;
      let result = await code.func.call(obj, script.param1, script.param2, script.param3, { type });
      if (typeof result === 'object') {
        ret = result.nextScriptId;
        endFlag = result.endFlag;
      } else {
        ret = result;
      }

      if (ret == null) {
        scriptEntry = scriptEntry + 1;
      } else if (result.gotoFlag) {
        scriptEntry = ret;
      } else if (ret === REPLACE_ENTRY) {
        startScriptId = scriptEntry + 1;
        scriptEntry = scriptEntry + 1;
      } else if (ret === RESET_SCRIPT) {
        scriptEntry = startScriptId;
      } else if (ret >= 0) {    // 有可能会返回0，比如脚本号9437
        scriptEntry = ret;
      } else if (ret === CIRCLE_SCRIPT) {
        // 还是执行当前脚本，但可能是退出指令
        // continue;
      } else {
        // 留着给特殊情况，这里先走下一步
        scriptEntry = scriptEntry + 1;
      }

      if(window.onSceneUpdate) {
        window.onSceneUpdate();
      }
    }

    return scriptEntry;
  },

  // 步进执行单条指令，用于 auto NPC 在每次 tick 中仅执行单条命令，避免 While 循环阻塞
  async stepOneInstruction(obj) {
    const startScriptId = obj.autoScr;
    const scriptId = startScriptId;
    const type = 'auto';

    const script = state.scripts[scriptId];
    if (!script) {
      console.warn(`自动脚本越界 ${scriptId}`);
      return scriptId;
    }

    const code = scriptCodes[script.code];
    const desc = code ? code.desc : '未知指令';

    // 生成 auto NPC 的对象标识标签
    const objTag = obj && typeof obj.id === 'number' ? `N${obj.id}` : '';

    // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
    const logItem = {
      npcId: obj ? obj.id : '无',
      mgoId: obj && typeof obj.mgoId === 'number' ? obj.mgoId : null,
      type: type,
      objTag: objTag,
      scriptId: scriptId,
      code: script.code,
      hexCode: '0x' + Hex.toHex(script.code),
      desc: desc,
      param1: script.param1,
      param2: script.param2,
      param3: script.param3,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };

    state.scriptLogs.push(logItem);
    if (state.scriptLogs.length > 40) {
      state.scriptLogs.shift();
    }

    if (window.onScriptExecute) {
      window.onScriptExecute(logItem);
    }

    if (!code) {
      console.warn(`[warn] [NPC ${obj?.id || '无'} scriptId:${scriptId}]: execute ${Hex.toHex(script.code)}`);
      return scriptId + 1;
    }

    const tab = type.charAt(0).toUpperCase();
    // console.log(`[info] [${tab} NPC:${obj?.id || '无'} IP:${scriptId}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

    let scriptEntry = scriptId;
    if (!code.func) {
      // 指令还没有支持，跳过 
      return scriptEntry + 1;
    }

    let ret = -1;
    let result = await code.func.call(obj, script.param1, script.param2, script.param3, { type: 'auto' });
    if (typeof result === 'object') {
      ret = result.nextScriptId;
    } else {
      ret = result;
    }
    
    if (ret == null) {
      return scriptEntry + 1;
    } else if (result.gotoFlag) {
      obj.autoScr = ret;
      return await Script.stepOneInstruction(obj);
    } else if (ret == RESET_SCRIPT) {
      obj.autoScr = null;
      return null;
    } else if (ret >= 0) {
      return ret;
    } else if (ret === CIRCLE_SCRIPT) {
      // scriptEntry 与 scriptId 都不动
      return scriptEntry;
    } else {
      // 留着给特殊情况，这里先走下一步
      scriptEntry = scriptEntry + 1;
    }
  },

  // 步进所有 auto NPC 并更新屏幕画面
  async stepAutoAndUpdate() {
    // 步骤 1：遍历所有的 NPC 事件物体并单步执行其 auto 脚本 (传参由 o.thread 修正为 o)
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (!o || o.state === 0 || o.mgoId === 0 || o.type !== 'npc' || o.nouse !== 0) continue;

      if (o.autoScr) {
        const ret = await Script.stepOneInstruction(o);
        o.autoScr = ret;
      }
    }

    // 步骤 3：重绘整个画面
    await update();
  }

};
