import { state } from './state.js';
import { Thread } from './thread.js';
import { Timer } from './timer.js';

export const Script = {
  all: [],
  total: 0,
  autoThreads: [],

  startScene(scene) {
    Script.all = [];
    Script.autoThreads = [];
    Script.total = 0;

    Script.start(scene.enterScriptId, scene, 'scene');

    // 载入当前场景内的所有事件/NPC 的 auto 脚本
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (!o || o.state === 0 || o.mgoId === 0) {
        continue;
      }
      // if (o.autoScr) {
      //   Script.start(o.autoScr, o, 'auto');
      // }
    }
  },

  startAutoScript(obj) {
    Script.start(obj.autoScr, obj, 'auto');
  },

  startTrigScript(obj) {
    Script.start(obj.trigScr, obj, 'trig');
  },

  startItemScript(obj) {
    Script.start(obj.useScr, obj, 'item');
  },

  mainLoop() {
    // 步骤 1：步进底层动画和定时任务（原来在 timer.js 的 anims 遍历）
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
      import('../ui/draw.js').then(({ update }) => update());
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
      return;
    }

    // 步骤 5：步进当前活跃的非 auto 类主线程（进入场景脚本、交互触发脚本等）
    let blockAuto = false;
    for (let i = 0; i < Script.all.length; i++) {
      const t = Script.all[i];
      if (t && !t.finish && t.type !== 'auto') {
        if (!t.pause) {
          t.next();
        }
        blockAuto = true;
      }
    }

    // 步骤 6：步进 auto NPC 漫游线程，每次 tick 只执行单条指令
    if (!blockAuto) {
      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const o = state.eventObjects[i];
        if (!o || o.state === 0 || o.mgoId === 0) continue;

        if (o.thread) {
          if (!o.thread.finish && !o.thread.pause) {
            o.thread.stepOneInstruction();
          }
        } else if (o.autoScr) {
          Script.startAutoScript(o);
        }
      }
    }

    // 步骤 7：画面统一重绘同步
    import('../ui/draw.js').then(({ update }) => update());
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

  // 启动脚本。由于脚本需要并行运行，所以存在多实例情况
  setAutoThread(scriptId, obj, type) {
    if (obj.thread) {
      obj.thread.scriptId = scriptId;
      obj.thread.reset();
      return ;
    }

    const thread = new Thread(scriptId, obj, type);
    thread.index = Script.total++;
    Script.all[Script.total++] = thread;
    if (type == 'auto') {
      obj.thread = thread;
    }
  },

  // 启动脚本。由于脚本需要并行运行，所以存在多实例情况
  start(scriptId, obj, type) {
    const thread = new Thread(scriptId, obj, type);
    thread.index = Script.total++;
    Script.all[Script.total++] = thread;
    if (type == 'auto') {
      obj.thread = thread;
    }

    thread.start();

    // 每当启动或销毁脚本时，刷新 UI
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
  }
};
