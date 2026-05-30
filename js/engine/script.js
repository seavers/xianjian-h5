import { state } from './state.js';
import { Thread } from './thread.js';
import { isTalking } from '../ui/talk.js';
import { scriptCodes, performToggleScene } from './command.js';
import { Hex } from '../utils/hex.js';
import { update } from '../ui/draw.js';

export const Script = {
  activeThread: null,

  startScene(scene) {
    Script.start(scene.enterScriptId, scene, 'scene');
  },

  startTrigScript(obj) {
    Script.start(obj.trigScr, obj, 'trig');
  },

  startItemScript(obj) {
    Script.start(obj.useScr, obj, 'item');
  },

  // 1. 150ms 周期性调用的游戏主循环入口，每次只执行一次逻辑 tick
  mainLoop() {
    Script.tick();
  },

  // 4. 规范化的逻辑帧嘀嗒（负责原本单次游戏循环中的全部逻辑更新与统一渲染）
  tick() {
    // 步骤 1：检测是否需要进行场景切换（一律在主循环头部做同步判定）
    if (state.nextSceneId !== state.sceneId && state.nextSceneId !== -1) {
      this.handleSceneSwitch();
      return;
    }

    // 步骤 2：步进场景渐变过渡动画任务（由主时钟 tick 同步驱动，支持变速齿轮自适应，且异步分发完成回调）
    if (state.transitionTask) {
      const task = state.transitionTask;
      task.frame++;
      if (task.frame <= task.duration) {
        if (task.type === 'fadeOut') {
          state.fadeAlpha = task.frame / task.duration;
        } else {
          state.fadeAlpha = 1 - task.frame / task.duration;
        }
      } else {
        if (task.type === 'fadeOut') {
          state.fadeAlpha = 1;
        } else {
          state.fadeAlpha = 0;
        }
        state.transitionTask = null;
        if (task.callback) {
          setTimeout(task.callback, 0); // 异步触发完成回调，彻底阻断重入竞态冲突
        }
      }
    }

    // 步骤 3：处理游戏硬挂起状态（如渐变动画中或 ESC 打开时，仅重绘画面以保持动画连贯，不步进任何游戏脚本和 auto 漫游）
    if (state.isPaused) {
      update(true);
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

    // 步骤 5：步进当前活跃的非 auto 类主线程（进入场景脚本、交互触发脚本等）
    const t = Script.activeThread;
    if (t && !t.finish) {
      if (!t.pause) {
        this.stepThread(t);
      }
    }

    // 步骤 6：步进 auto NPC 漫游线程。判定依据为事件物体的类型 type === 'npc'
    // 剧情对话 (isTalking) 展示期间，跳过 auto 漫游步进以完全挂起漫游 NPC，杜绝对话期间 NPC 步态和移位
    if (!isTalking) {
      const autoLogs = [];

      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const o = state.eventObjects[i];
        if (!o || o.state === 0 || o.mgoId === 0 || o.type !== 'npc') continue;

        if (o.autoScr) {
          // 如果还没有 thread 或者 thread 已经结束，则惰性创建 thread 状态记录，但不当场运行
          if (!o.thread || o.thread.finish) {
            Script.setAutoThread(o.autoScr, o, 'auto');
          }
          
          if (o.thread && !o.thread.finish && !o.thread.pause) {
            const logItem = this.stepOneInstruction(o.thread);
            if (logItem) {
              autoLogs.push(logItem);
            }
          }
        }
      }

      // 所有 auto 脚本执行完毕后，统一批量回调脚本执行钩子，大幅减少重绘次数
      if (autoLogs.length > 0 && window.onScriptExecute) {
        window.onScriptExecute(autoLogs);
      }
    }

    // 步骤 7：画面统一重绘同步
    update(true);
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
      
      update('fadeOut', () => {
        performToggleScene(targetSceneId);
        update('fadeIn', () => {
          state.isPaused = false;
        });
      });
    } else {
      // 直接切换场景
      performToggleScene(targetSceneId);
    }
  },

  // 惰性配置 Auto NPC 漫游状态
  setAutoThread(scriptId, obj, type) {
    if (obj.thread) {
      obj.thread.scriptId = scriptId;
      obj.thread.reset();
      return ;
    }

    obj.thread = new Thread(scriptId, obj, type);
  },

  // 启动并注册脚本线程状态
  start(scriptId, obj, type) {
    const thread = new Thread(scriptId, obj, type);
    if (type !== 'auto') {
      Script.activeThread = thread;
    } else {
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
      if (thread === Script.activeThread) {
        Script.activeThread = thread.parent || null;
      }
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
    if (thread === Script.activeThread) {
      Script.activeThread = thread.parent || null;
    }

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

  // 步进执行动画/步态进度。如果动画正在进行则返回剩余步数，全部执行完毕则返回 0
  stepProgress(obj, total, func) {
    if (!obj.animStep) {
      obj.animStep = 0;
    }
    
    if (obj.animStep < total) {
      if (func) func(obj.animStep + 1);
      obj.animStep++;
      return total - obj.animStep; // 返回剩余步数，以作为非零信号挂起指令
    }
    
    // 执行完毕，重置状态并返回 0
    obj.animStep = 0;
    return 0;
  },

  sub(scriptId, targetObj) {
    const thread = Thread.currentThread;
    if (!thread) return;

    thread.wait();
    
    // 步骤 1：若提供了自定义目标物体 targetObj 则在新线程中绑定该物体，否则继承父线程的对象自身 thread.obj
    const activeObj = targetObj !== undefined ? targetObj : thread.obj;
    
    const sub = new Thread(scriptId, activeObj, thread.type, () => {
      Script.activeThread = thread; // 子脚本执行完毕，将 activeThread 自适应恢复为父脚本
      thread.notify();
    });
    sub.parent = thread;
    Script.activeThread = sub; // 将当前活跃的阻塞主线程推进为新启动的子脚本

    sub.start();

    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  isExec() {
    const t = Script.activeThread;
    return !!(t && !t.finish);
  },

  isAuto(thread) {
    return thread.type === 'auto';
  },

  sleep(time) {
    return Script.stepProgress(state.roles[0], time);
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

      const script = state.scripts[thread.scriptId];
      if (!script) {
        console.warn(`Thread #${thread.id} scriptId: ${thread.scriptId} 越界`);
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
        scriptId: thread.scriptId,
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
        console.warn(`[warn] [NPC ${thread.obj?.id || '无'} scriptId:${thread.scriptId}]: execute ${Hex.toHex(script.code)}`);
        thread.scriptId++; // 未知指令跳过
        continue;
      }

      if (script.code === 0) {
        thread.stop();
        break;
      }

      const tab = thread.type.charAt(0).toUpperCase();
      console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

      if (code.func) {
        const ret = code.func.call(thread.obj, script.param1, script.param2, script.param3);
        
        // 核心协同挂起控制：
        // 如果指令返回 大于 0 的未完成帧计数，表示指令需要跨多 tick 进行状态步进
        // 我们在此直接退出 While 循环，不递增指令指针 IP，等待下一 tick 重新执行该指令。
        if (typeof ret === 'number' && ret > 0) {
          return;
        }
      }

      // 本条指令执行成功，指向下一条指令
      thread.scriptId++;
    }
  },

  // 步进执行单条指令，用于 auto NPC 在每次 tick 中仅执行单条命令，避免 While 循环阻塞
  stepOneInstruction(thread) {
    if (thread.finish || thread.pause) return null;

    Thread.currentThread = thread;

    const script = state.scripts[thread.scriptId];
    if (!script) {
      console.warn(`Thread #${thread.id} scriptId: ${thread.scriptId} 越界`);
      thread.stop();
      return null;
    }

    const code = scriptCodes[script.code];
    const desc = code ? code.desc : '未知指令';

    // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
    const logItem = {
      id: thread.id,
      npcId: thread.obj ? thread.obj.id : '无',
      mgoId: thread.obj && typeof thread.obj.mgoId === 'number' ? thread.obj.mgoId : null,
      type: thread.type,
      scriptId: thread.scriptId,
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

    if (!code) {
      console.warn(`[warn] [NPC ${thread.obj?.id || '无'} scriptId:${thread.scriptId}]: execute ${Hex.toHex(script.code)}`);
      thread.scriptId++;
      return logItem;
    }

    if (script.code === 0) {
      thread.stop();
      return logItem;
    }

    const tab = thread.type.charAt(0).toUpperCase();
    console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

    if (code.func) {
      const ret = code.func.call(thread.obj, script.param1, script.param2, script.param3);
      
      // 同理，如果 auto NPC 执行指令尚未完成，直接退出且不递增指令指针 IP
      if (typeof ret === 'number' && ret > 0) {
        return logItem;
      }
    }

    thread.scriptId++;
    return logItem;
  }
};
