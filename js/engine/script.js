import { state } from './state.js';
import { Thread } from './thread.js';
import { scriptCodes, performToggleScene } from './command.js';
import { Hex } from '../utils/hex.js';
import { update } from '../ui/draw.js';
import { fadeIn, fadeOut } from '../ui/fade.js';
import { ESC } from '../esc/esc.js';

export const Script = {
  NEXT_SCRIPT: -1,      // 当前轮，直接继续下一条指令
  GOTO_SCRIPT: 4,       // 当前轮，直接跳转至指定指令
  FINISH_SCRIPT: 0,     // 结束指令，下一轮，没有指令
  STOP_SCRIPT: 1,       // 停止指令，下一轮，可能有其它指令
  CHANGE_SCRIPT: 2,     // 下一轮，是指定的指令，若无，就是下一条指令
  DELAY_SCRIPT: -5,     // 下一轮，依然是同一条指令
  YIELD_SCRIPT: -6,     // 下一轮，继续下一条指令

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

  isLoopRunning: false,

  // 1. 150ms 周期性调用的游戏主循环入口，通过 isLoopRunning 并发锁，防止 await 期间新周期重入
  async mainLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    try {
      await Script.tick();
    } finally {
      this.isLoopRunning = false;
    }
  },

  // 4. 规范化的逻辑帧嘀嗒（负责原本单次游戏循环中的全部逻辑更新与统一渲染）
  async tick() {
    // 步骤 1.5：只有在常规游戏探索状态下才步进逻辑帧，其他状态（如 esc, startup, talk 等）一律挂起
    if (state.currentMode !== 'game') {
      return;
    }

    // 步骤 1.8：如果当前正处于对话按键等待挂起状态，单独步进闪烁箭头动画，并直接挂起逻辑帧，避免调用整体重绘 update(true)
    if (window.Talk && window.Talk.isWaiting) {
      window.Talk.tickArrow();
      return;
    }

    // 步骤 1：检测是否需要进行场景切换（一律在主循环头部做同步判定）
    if (state.nextSceneId !== state.sceneId && state.nextSceneId !== -1) {
      await this.handleSceneSwitch();
      return;
    }

    // 步骤 2：步进场景渐变过渡动画任务已由 draw.js 中的本地定时高帧率循环渲染替代，彻底移除原本的 tick 步进以支持自然阻塞

    // 步骤 3：处理游戏硬挂起状态（如渐变动画中或 ESC 打开时，仅重绘画面以保持动画连贯，不步进任何游戏脚本和 auto 漫游）
    if (state.isPaused) {
      await update(true);
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

    // 步骤 4.5：更新所有事件物体的 sVanishTime (即 nouse)
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (o && o.nouse !== 0) {
        o.nouse += (o.nouse < 0 ? 1 : -1);
      }
    }

    // 步骤 5：步进当前活跃的非 auto 类主线程（进入场景脚本、交互触发脚本等）
    const t = Script.activeThread;
    if (t && !t.finish) {
      if (!t.pause) {
        await this.stepThread(t);
      }
    }

    // 步骤 6：步进 auto NPC 漫游线程。判定依据为事件物体的类型 type === 'npc'
    // 特殊情况，跳过 auto 漫游步进以完全挂起漫游 NPC，杜绝对话期间 NPC 步态和移位
    if (true) {
      const autoLogs = [];

      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const o = state.eventObjects[i];
        if (!o || o.state === 0 || o.mgoId === 0 || o.type !== 'npc' || o.nouse !== 0) continue;

        if (o.autoScr) {
          // 如果还没有 thread 或者 thread 已经结束，则惰性创建 thread 状态记录，但不当场运行
          if (!o.thread) {
            o.thread = new Thread(o.autoScr, o, 'auto');
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
    await update(true);
  },

  async handleSceneSwitch() {
    const targetSceneId = state.nextSceneId;
    const needFade = state.needToFadeIn;

    // 重置挂起的切换标志，避免重复执行
    state.nextSceneId = -1;
    state.needToFadeIn = false;

    if (needFade) {
      // 场景淡出切换流程，期间暂停主循环
      state.isPaused = true;
      
      await fadeOut();
      performToggleScene(targetSceneId);
      await fadeIn();
      
      state.isPaused = false;
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
      if (thread.type === 'trig' && thread.nextScriptId !== undefined && thread.nextScriptId !== null) {
        thread.obj.trigScr = thread.nextScriptId;
      }
    }
    if(obj && obj.thread == thread) {
      obj.thread = null;
    }

    // 停止指令
    if (obj.type == 'npc') {
      obj.autoScr = null;
    }

    // 兜底释放：如果没有任何阻塞主线程，且当前依然是对话状态，强制退出 talk 模式并清空画布
    // if (!Script.activeThread) {
    //   window.Talk.clearTalk();
    // }

    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  stop(scriptId) {
    const thread = Thread.currentThread;
    if (!thread) return;

    scriptId = (thread.nextScriptId !== undefined && thread.nextScriptId !== null) ? thread.nextScriptId : (scriptId || thread.scriptId);

    if (thread.type === 'auto') {
      thread.obj.autoScr = scriptId;
      thread.obj.thread = null;
    } else if (thread.type === 'scene') {
      thread.obj.enterScriptId = scriptId;
    } else if (thread.type === 'trig') {
      thread.obj.trigScr = scriptId;
    }

    thread.stop();
    if (thread === Script.activeThread) {
      Script.activeThread = thread.parent || null;
    }

    // 兜底释放：如果没有任何阻塞主线程，且当前依然是对话状态，强制退出 talk 模式并清空画布
    // if (!Script.activeThread) {
    //   window.Talk.resetTalk();
    //   window.Talk.updateTalk();
    // }

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

  sub(scriptId, targetObj) {
    const thread = Thread.currentThread;
    if (!thread) return Promise.resolve();

    thread.wait();
    
    // 步骤 1：若提供了自定义目标物体 targetObj 则在新线程中绑定该物体，否则继承父线程的对象自身 thread.obj
    const activeObj = targetObj !== undefined ? targetObj : thread.obj;
    
    return new Promise(async (resolve) => {
      const sub = new Thread(scriptId, activeObj, thread.type, () => {
        Script.activeThread = thread; // 子脚本执行完毕，将 activeThread 自适应恢复为父脚本
        thread.notify();
        resolve();
      });
      sub.parent = thread;
      Script.activeThread = sub; // 将当前活跃的阻塞主线程推进为新启动的子脚本

      sub.start();
      await this.stepThread(sub);

      if (window.onThreadsUpdate) {
        window.onThreadsUpdate();
      }
    });
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
  async stepThread(thread) {
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
        console.warn(`[warn] [NPC ${thread.obj?.id || '无'} scriptId:${thread.scriptId}]: execute ${Hex.toHex(script.code)}`);
        thread.scriptId++; // 未知指令跳过
        continue;
      }

      const tab = thread.type.charAt(0).toUpperCase();
      console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

      if (code.func) {
        // 步骤 1：在异步调用前确保 Thread.currentThread 设定为当前活跃执行的线程本身
        Thread.currentThread = thread;
        const ret = await code.func.call(thread.obj, script.param1, script.param2, script.param3);
        // 步骤 2：异步 await 回归后，强制恢复 Thread.currentThread 上下文，防止并发转折时被篡改或丢失
        Thread.currentThread = thread;
        
        // 核心协同挂起控制：
        // 如果指令返回 大于 0 的未完成帧计数，表示指令需要跨多 tick 进行状态步进
        // 我们在此等待 150ms 逻辑帧，不递增指令指针 IP 并退出，以便下一逻辑帧重新执行。
        if (ret == this.NEXT_SCRIPT) {
          // ...next
        } else if (ret == this.DELAY_SCRIPT) {
          return;
        } else if (ret === this.YIELD_SCRIPT) {
          thread.scriptId++;
          return;
        } else if (ret === this.GOTO_SCRIPT) {
          continue;
        } else if (ret === this.STOP_SCRIPT) {
          thread.scriptId++;
          return;
        } else if (ret === this.FINISH_SCRIPT) {
          return;
        } else if (ret === this.CHANGE_SCRIPT) {
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
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
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

    const tab = thread.type.charAt(0).toUpperCase();
    console.log(`[info] [${tab} NPC:${thread.obj?.id || '无'} IP:${thread.scriptId}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

    if (code.func) {
      const ret = code.func.call(thread.obj, script.param1, script.param2, script.param3);
      
      // 同理，如果 auto NPC 执行指令尚未完成，直接退出且不递增指令指针 IP
      if (ret == this.NEXT_SCRIPT) {
        // ...next
      } else if (ret == this.DELAY_SCRIPT) {
        return;
      } else if (ret === this.YIELD_SCRIPT) {
        thread.scriptId++;
        return;
      } else if (ret === this.GOTO_SCRIPT) {
        // continue;
        return;
      } else if (ret === this.STOP_SCRIPT) {
        thread.scriptId++;
        return;
      } else if (ret === this.FINISH_SCRIPT) {
        return;
      } else if (ret === this.CHANGE_SCRIPT) {
        return;
      }
    }

    thread.scriptId++;
    return logItem;
  }
};
