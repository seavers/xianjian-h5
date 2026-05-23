import { state } from './state.js';
import { scriptCodes } from './command.js';
import { Hex } from '../utils/hex.js';
import { Timer } from './timer.js';

let threadIdCounter = 1;

export class Thread {
  constructor(scriptId, o, type, callback) {
    this.id = threadIdCounter++;
    this.scriptId = scriptId;
    this.obj = o;     // 当前绑定的 NPC / 事件对象
    this.type = type; // trig / auto / scene / item
    this.callback = callback;
    this.finish = false;
    this.pause = false;
  }

  start() {
    this.finish = false;
    this.next();
  }

  stop() {
    this.finish = true;
    if (Thread.currentThread === this) {
      Thread.currentThread = null;
    }

    if (this.callback) {
      this.callback();
    }

    if (this.type !== 'auto') {
      Timer.start();
    }
  }

  wait() {
    this.pause = true;
  }

  notify() {
    this.pause = false;
    this.next();
  }

  next() {
    while (!this.pause && !this.finish) {
      Thread.currentThread = this;

      const script = state.scripts[this.scriptId++]; // 先执行当条，再指向下一条
      if (!script) {
        console.warn(`Thread #${this.id} scriptId: ${this.scriptId - 1} 越界`);
        this.stop();
        break;
      }

      const code = scriptCodes[script.code];
      
      // 记录到全局状态机中的 scriptLogs，供右侧 Dashboard 实时渲染
      const desc = code ? code.desc : '未知指令';
      const logItem = {
        id: this.id,
        npcId: this.obj ? this.obj.id : '无',
        type: this.type,
        scriptId: this.scriptId - 1,
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

      // 通知前端监控台重绘日志面板
      if (window.onScriptExecute) {
        window.onScriptExecute(logItem);
      }

      if (!code) {
        console.warn(`[warn] [NPC ${this.obj?.id || '无'} scriptId:${this.scriptId - 1}]: execute ${Hex.toHex(script.code)} ${Hex.toHex(script.param1)}`);
        continue;
      }

      if (script.code === 0) {
        this.stop();
        break;
      }

      const tab = this.type.charAt(0).toUpperCase();
      console.log(`[info] [${tab} NPC:${this.obj?.id || '无'} IP:${this.scriptId - 1}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

      if (code.func) {
        code.func.call(this.obj, script.param1, script.param2, script.param3);
      }
    }
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
