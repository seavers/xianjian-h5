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
      if (!o || o.state === 0 || o.roleId === 0) {
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

  loop() {
    // 执行当前场景内的所有事件/NPC 的 auto 脚本
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (!o || o.state === 0 || o.roleId === 0) {
        continue;
      }
      if (o.thread) {
        if(!o.thread.finish) {
          o.thread.next();
        } 
      } else if (o.autoScr) {
        Script.startAutoScript(o);
      }
    }
  },


  // 启动脚本。由于脚本需要并行运行，所以存在多实例情况
  setAutoThread(scriptId, obj, type) {
    if (type !== 'auto') {
      Timer.stop();
    }

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
    if (type !== 'auto') {
      Timer.stop();
    }

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
      thread.obj.autoScr = scriptId;
    } else if (thread.type === 'scene') {
      thread.obj.enterScriptId = scriptId;
    } else if (thread.type === 'trig') {
      thread.obj.trigScr = scriptId;
    }

    thread.stop();

    if (thread.type !== 'auto') {
      Timer.start();
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
