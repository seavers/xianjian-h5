import { state } from './state.js';
import { Thread } from './thread.js';
import { Timer } from './timer.js';

export const Script = {
  all: [],
  total: 0,

  startScene(scene) {
    Script.all = [];
    Script.total = 0;

    Script.start(scene.enterScriptId, scene, 'scene');

    // 载入当前场景内的所有事件/NPC 的 auto 脚本
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (!o || o.state === 0 || o.roleId === 0) {
        continue;
      }
      if (o.autoScr) {
        Script.start(o.autoScr, o, 'auto');
      }
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

  // 启动脚本。由于脚本需要并行运行，所以存在多实例情况
  start(scriptId, obj, type) {
    if (type !== 'auto') {
      Timer.stop();
    }

    const thread = new Thread(scriptId, obj, type);
    thread.index = Script.total;
    Script.all[Script.total++] = thread;

    thread.start();

    // 每当启动或销毁脚本时，刷新 UI
    if (window.onThreadsUpdate) {
      window.onThreadsUpdate();
    }
  },

  finish() {
    const thread = Thread.currentThread;
    if (thread) {
      thread.stop();
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
    Timer.queue(total, func, () => {
      thread.notify();
    }, force);
  }
};
