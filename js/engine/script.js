import { state } from './state.js';
import { Thread } from './thread.js';
import { Timer } from './timer.js';
import { scriptCodes } from './command.js';
import { Hex } from '../utils/hex.js';

export const Script = {
  all: [],
  total: 0,
  autoThreads: [],
  lastTime: 0,
  accumulator: 0,

  startScene(scene) {
    Script.all = [];
    Script.autoThreads = [];
    Script.total = 0;

    Script.start(scene.enterScriptId, scene, 'scene');
  },

  startTrigScript(obj) {
    Script.start(obj.trigScr, obj, 'trig');
  },

  startItemScript(obj) {
    Script.start(obj.useScr, obj, 'item');
  },

  // 1. requestAnimationFrame 中央高频驱动入口，接收系统时间戳，进行时间累加和变速计算
  mainLoop(timestamp) {
    if (!timestamp) {
      timestamp = performance.now();
    }
    if (!Script.lastTime) {
      Script.lastTime = timestamp;
    }

    const dt = timestamp - Script.lastTime;
    Script.lastTime = timestamp;

    // 限制单帧最大时间间隔为 250ms，防止浏览器在切后台挂起或极度卡顿时瞬间累加超长 deltaTime，导致异常大跨度追帧
    const clampedDt = Math.min(dt, 250);

    // 如果 Timer 整体暂停，则不推进时钟累加器，也不执行逻辑 tick()
    if (Timer.isPaused()) {
      return;
    }

    // 2. 动态读取变速齿轮 state.frameCount，实时计算每一逻辑帧所需的毫秒数
    const frameInterval = 1000 / (state.frameCount || 6);
    Script.accumulator += clampedDt;

    // 3. 当时间片足够时，步进执行一个或多个 tick 逻辑帧，确保流畅的游戏节奏
    while (Script.accumulator >= frameInterval) {
      Script.tick();
      Script.accumulator -= frameInterval;
    }
  },

  // 4. 规范化的逻辑帧嘀嗒（负责原本单次游戏循环中的全部逻辑更新与统一渲染）
  tick() {
    // 步骤 1：步进底层动画和定时任务
    let animCount = 0;
    const anims = Timer.DEBUG.anims;
    for (const key in anims) {
      const func = anims[key];
      if (func) {
        const index = func.index || 0;
        func(index + 1);
        func.index = index + 1;
        animCount++;
      }
    }

    // 步骤 2：处理游戏挂起状态（如渐变动画中或 ESC 打开时）
    if (state.isPaused) {
      // 仅重绘画面以保持动画连贯，不步进任何游戏脚本
      import('../ui/draw.js').then(({ update }) => update(true));
      return;
    }

    // 步骤 3：检测是否需要进行场景切换（一律在主循环头部做同步判定）
    if (state.nextSceneId !== state.sceneId && state.nextSceneId !== -1) {
      this.handleSceneSwitch();
      return;
    }

    // 步骤 4：检测是否有延迟触发的 trigger 交互脚本需要激活
    if (state.nextTriggerScriptId !== undefined && state.nextTriggerScriptId !== null && state.nextTriggerScriptId !== -1) {
      const scriptId = state.nextTriggerScriptId;
      const obj = state.nextTriggerScriptObject;
      
      // 重置延迟触发器状态
      state.nextTriggerScriptId = -1;
      state.nextTriggerScriptObject = null;
      
      Script.start(scriptId, obj, 'trig');
      // 激活后继续向下运行，以便在同一个 tick 中直接步进该脚本，保持高响应性
    }

    // 步骤 5：步进当前活跃 of 非 auto 类主线程（进入场景脚本、交互触发脚本等）
    let blockAuto = false;
    for (let i = 0; i < Script.all.length; i++) {
      const t = Script.all[i];
      if (t && !t.finish && t.type !== 'auto') {
        if (!t.pause) {
          this.stepThread(t);
        }
        blockAuto = true;
      }
    }

    // 步骤 6：步进 auto NPC 漫游线程。判定依据为事件物体的类型 type === 'npc'
    if (!blockAuto) {
      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const o = state.eventObjects[i];
        if (!o || o.state === 0 || o.mgoId === 0 || o.type !== 'npc') continue;

        if (o.autoScr) {
          // 如果还没有 thread 或者 thread 已经结束，则惰性创建 thread 状态记录，但不当场运行
          if (!o.thread || o.thread.finish) {
            Script.setAutoThread(o.autoScr, o, 'auto');
          }
          
          if (o.thread && !o.thread.finish && !o.thread.pause) {
            this.stepOneInstruction(o.thread);
          }
        }
      }
    }

    // 步骤 7：画面统一重绘同步
    import('../ui/draw.js').then(({ update }) => update(true));
  },

  handleSceneSwitch() {
    const targetSceneId = state.nextSceneId;
    const needFade = state.needToFadeIn;

    // 重置挂起的切换标志，避免重复执行
    state.nextSceneId = -1;
    state.needToFadeIn = false;

    if (needFade) {
      // 场景淡出切换流程，期间暂停主循环
      state.isPaused = true;
      
      import('../ui/draw.js').then(({ update }) => {
        update('fadeOut', () => {
          import('./command.js').then(({ performToggleScene }) => {
            performToggleScene(targetSceneId);
            update('fadeIn', () => {
              state.isPaused = false;
            });
          });
        });
      });
    } else {
      // 直接切换场景
      import('./command.js').then(({ performToggleScene }) => {
        performToggleScene(targetSceneId);
      });
    }
  },

  // 惰性配置 Auto NPC 漫游状态
  setAutoThread(scriptId, obj, type) {
    if (obj.thread) {
      obj.thread.scriptId = scriptId;
      obj.thread.reset();
      return ;
    }

    const thread = new Thread(scriptId, obj, type);
    thread.index = Script.total++;
    Script.all.push(thread);
    if (type == 'auto') {
      obj.thread = thread;
    }
  },

  // 启动并注册脚本线程状态
  start(scriptId, obj, type) {
    const thread = new Thread(scriptId, obj, type);
    thread.index = Script.total++;
    Script.all.push(thread);
    if (type == 'auto') {
      obj.thread = thread;
    }

    thread.start();

    // 刷新 UI
    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  finish(obj) {
    const thread = Thread.currentThread;
    if (thread) {
      thread.stop();
    }
    if(obj && obj.thread == thread) {
      obj.thread = null;
    }
    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  stop(scriptId) {
    const thread = Thread.currentThread;
    if (!thread) return;

    scriptId = scriptId || thread.scriptId;

    if (thread.type === 'auto') {
      // thread.obj.autoScr = scriptId;
    } else if (thread.type === 'scene') {
      thread.obj.enterScriptId = scriptId;
    } else if (thread.type === 'trig') {
      thread.obj.trigScr = scriptId;
    }

    thread.stop();

    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  next(scriptId) {
    const thread = Thread.currentThread;
    if (thread) {
      thread.scriptId = scriptId;
    }
  },

  sub(scriptId) {
    const thread = Thread.currentThread;
    if (!thread) return;

    thread.wait();
    const sub = new Thread(scriptId, thread.obj, thread.type, () => {
      thread.notify();
    });
    sub.parent = thread;
    sub.start();

    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  isExec() {
    for (const k in Script.all) {
      const script = Script.all[k];
      if (script && !script.finish && script.type !== 'auto') {
        return true;
      }
    }
    return false;
  },

  isAuto(thread) {
    return thread.type === 'auto';
  },

  sleep(time) {
    const thread = Thread.currentThread;
    if (!thread) return;

    const force = thread.type !== 'auto';
    thread.wait();
    Timer.queue(time, undefined, () => {
      thread.notify();
    }, force);
  },

  draw(total, func) {
    const thread = Thread.currentThread;
    if (!thread) return;

    const force = thread.type !== 'auto';
    thread.wait();

    const timer = Timer.queue(total, func, () => {
      thread.notify();
    }, force);
    thread.timer = timer;
  },

  // 集中推进非 auto 类型的阻塞脚本主线程，运行 While 指令解析循环
  stepThread(thread) {
    if (thread.finish || thread.pause) return;

    Thread.currentThread = thread;

    while (!thread.pause && !thread.finish) {
      // 1. 核心单步调试拦截点
      if (window.STEP_DEBUG && thread.type !== 'auto') {
        window.ACTIVE_DEBUG_THREAD = thread;
        thread.wait();
        if (window.onStepDebugPause) {
          window.onStepDebugPause(thread);
        }
        break;
      }

      const script = state.scripts[thread.scriptId++];
      if (!script) {
        console.warn(`Thread #${thread.id} scriptId: ${thread.scriptId - 1} 越界`);
        thread.stop();
        break;
      }

      const code = scriptCodes[script.code];
      const desc = code ? code.desc : '未知指令';

      // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
      const logItem = {
        id: thread.id,
        npcId: thread.obj ? thread.obj.id : '无',
        roleId: thread.obj && typeof thread.obj.mgoId === 'number' ? thread.obj.mgoId : null,
        type: thread.type,
        scriptId: thread.scriptId - 1,
        code: script.code,
        hexCode: '0x' + Hex.toHex(script.code),
        desc: desc,
        param1: script.param1,
        param2: script.param2,
        param3: script.param3,
        time: new Date().toLocaleTimeString()
      };

      state.scriptLogs.push(logItem);
      if (state.scriptLogs.length > 40) {
        state.scriptLogs.shift();
      }

      if (window.onScriptExecute) {
        window.onScriptExecute(logItem);
      }

      if (!code) {
        console.warn(`[warn] [NPC ${thread.obj?.id || '无'} scriptId:${thread.scriptId - 1}]: execute ${Hex.toHex(script.code)}`);
        continue;
      }

      if (script.code === 0) {
        thread.stop();
        break;
      }

      const tab = thread.type.charAt(0).toUpperCase();
      console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId - 1}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

      if (code.func) {
        const ret = code.func.call(thread.obj, script.param1, script.param2, script.param3);
        if (ret == -1) {
          return;
        }
      }
    }
  },

  // 步进执行单条指令，用于 auto NPC 在每次 tick 中仅执行单条命令，避免 While 循环阻塞
  stepOneInstruction(thread) {
    if (thread.finish || thread.pause) return;

    Thread.currentThread = thread;

    const script = state.scripts[thread.scriptId++];
    if (!script) {
      console.warn(`Thread #${thread.id} scriptId: ${thread.scriptId - 1} 越界`);
      thread.stop();
      return;
    }

    const code = scriptCodes[script.code];
    const desc = code ? code.desc : '未知指令';

    // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
    const logItem = {
      id: thread.id,
      npcId: thread.obj ? thread.obj.id : '无',
      roleId: thread.obj && typeof thread.obj.mgoId === 'number' ? thread.obj.mgoId : null,
      type: thread.type,
      scriptId: thread.scriptId - 1,
      code: script.code,
      hexCode: '0x' + Hex.toHex(script.code),
      desc: desc,
      param1: script.param1,
      param2: script.param2,
      param3: script.param3,
      time: new Date().toLocaleTimeString()
    };

    state.scriptLogs.push(logItem);
    if (state.scriptLogs.length > 40) {
      state.scriptLogs.shift();
    }

    if (window.onScriptExecute) {
      window.onScriptExecute(logItem);
    }

    if (!code) {
      console.warn(`[warn] [NPC ${thread.obj?.id || '无'} scriptId:${thread.scriptId - 1}]: execute ${Hex.toHex(script.code)}`);
      return;
    }

    if (script.code === 0) {
      thread.stop();
      return;
    }

    const tab = thread.type.charAt(0).toUpperCase();
    console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId - 1}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

    if (code.func) {
      const ret = code.func.call(thread.obj, script.param1, script.param2, script.param3);
      if (ret == -1) {
        return;
      }
    }
  }
};
