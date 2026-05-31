import { state } from './state.js';

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

  }

  start() {
    this.finish = false;
  }

  restart() {
    this.finish = false;
    this.pause = false;

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
    // 步骤 1：在 async/await 架构下，指令在 await 完结前 scriptId 尚未自增，因此探测下一条指令需要使用 scriptId + 1
    const script = state.scripts[this.scriptId + 1];
    if (!script) return false;
    return script.code === 0xFFFF;
  }

  isNextTalks() {
    // 步骤 2：同理，探测下一条指令是否为对话相关的指令，也使用 scriptId + 1
    const script = state.scripts[this.scriptId + 1];
    if (!script) return false;
    return script.code === 0xFFFF || script.code === 0x3C || script.code === 0x3D || script.code === 0x8E;
  }
}

Thread.currentThread = null;
