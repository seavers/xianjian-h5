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
    this.next();
  }

  restart() {
    this.finish = false;
    this.pause = false;
    if (this.timer) {
      Timer.clearTimer(this.timer);
      this.timer = null;
    }
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
    // 循环执行脚本指令，直到线程被暂停挂起或者执行完毕
    while (!this.pause && !this.finish) {
      // 1. 核心单步调试拦截点：如果全局单步调试模式开启，且不是 auto 漫游线程，则在此挂起
      if (window.STEP_DEBUG && this.type !== 'auto') {
        window.ACTIVE_DEBUG_THREAD = this;
        this.wait();

        // 广播当前暂停的线程对象，供前端调试器更新即将执行的指令信息
        if (window.onStepDebugPause) {
          window.onStepDebugPause(this);
        }
        break;
      }

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
        roleId: this.obj && typeof this.obj.roleId === 'number' ? this.obj.roleId : null,
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

  // 2. 专门用于单步执行一条指令的步进函数
  step() {
    if (this.finish) return;

    // 暂时解锁暂停状态，以仅允许单步执行当前的一条指令
    this.pause = false;
    Thread.currentThread = this;

    const script = state.scripts[this.scriptId++]; // 执行当前指令，并指向下一条
    if (!script) {
      this.stop();
      return;
    }

    const code = scriptCodes[script.code];
    const desc = code ? code.desc : '未知指令';
    
    // 组装调试日志快照，塞入流中
    const logItem = {
      id: this.id,
      npcId: this.obj ? this.obj.id : '无',
      roleId: this.obj && typeof this.obj.roleId === 'number' ? this.obj.roleId : null,
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

    // 触发前端实时日志渲染
    if (window.onScriptExecute) {
      window.onScriptExecute(logItem);
    }

    if (script.code === 0) {
      this.stop();
      return;
    }

    const tab = this.type.charAt(0).toUpperCase();
    console.log(`[step-info] [${tab} NPC:${this.obj?.id || '无'} IP:${this.scriptId - 1}]: execute 0x${Hex.toHex(script.code)} - ${desc}`);

    // 执行具体指令函数
    if (code && code.func) {
      code.func.call(this.obj, script.param1, script.param2, script.param3);
    }

    // 3. 单步指令执行完毕后，如果线程未被指令内生性挂起（如 wait 挂载），且单步模式仍开启，则重新挂起
    if (!this.pause && !this.finish) {
      this.wait();
      window.ACTIVE_DEBUG_THREAD = this;

      if (window.onStepDebugPause) {
        window.onStepDebugPause(this);
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
