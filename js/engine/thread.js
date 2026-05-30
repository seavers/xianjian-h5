import { state } from './state.js';
import { Timer } from './timer.js';

let threadIdCounter = 1;

// Thread 状态容器类，降维成纯粹的数据属性载体，彻底解耦指令执行逻辑
export class Thread {
  constructor(scriptId, o, type, callback) {
    this.id = threadIdCounter++;
    this.scriptId = scriptId;
    this.obj = o;     // 当前绑定的 NPC / 事件对象
    this.type = type; // trig / auto / scene / item
    this.callback = callback;
    this.finish = false;
    this.pause = false;
    this.timer = null;
  }

  reset() {
    this.finish = false;
    this.pause = false;
    if (this.timer) {
      Timer.clearTimer(this.timer);
      this.timer = null;
    }
  }

  start() {
    this.finish = false;
  }

  restart() {
    this.finish = false;
    this.pause = false;
    if (this.timer) {
      Timer.clearTimer(this.timer);
      this.timer = null;
    }
  }

  stop() {
    this.finish = true;
    if (Thread.currentThread === this) {
      Thread.currentThread = null;
    }

    if (this.callback) {
      this.callback();
    }
  }

  wait() {
    this.pause = true;
  }

  notify() {
    this.pause = false;
  }

  isNextTalk() {
    const script = state.scripts[this.scriptId];
    if (!script) return false;
    return script.code === 0xFFFF;
  }

  isNextTalks() {
    const script = state.scripts[this.scriptId];
    if (!script) return false;
    return script.code === 0xFFFF || script.code === 0x3C || script.code === 0x3D || script.code === 0x8E;
  }
}

Thread.currentThread = null;
