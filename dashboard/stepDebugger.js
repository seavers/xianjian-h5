export function initStepDebugger() {
  window.STEP_DEBUG = false;
  window.ACTIVE_DEBUG_THREAD = null;

  // 1. 初始化全局调试状态对象，作为 React 组件的数据源
  window.DEBUGGER_STATE = {
    enabled: false,
    status: 'STANDBY',
    instruction: null
  };

  let currentResolve = null;

  // 2. 统一的断点状态解决器，负责清空状态并 resolve 拦截 Promise
  function resolveBreakpoint(action) {
    if (currentResolve) {
      const resolve = currentResolve;
      currentResolve = null;
      window.ACTIVE_DEBUG_THREAD = null;
      window.DEBUGGER_STATE.status = 'STANDBY';
      window.DEBUGGER_STATE.instruction = null;
      window.onDebuggerStateChange?.();
      resolve(action);
    }
  }

  let loadMsgFn = null;
  let toSimplifiedFn = null;

  import('../js/resources/pal.js').then(({ loadMsg }) => {
    loadMsgFn = loadMsg;
  });

  import('../js/utils/t2s.js').then(({ toSimplified }) => {
    toSimplifiedFn = toSimplified;
    window.toSimplifiedFn = toSimplified;
  });

  const big5Decoder = new TextDecoder('big5');

  function resetStepDebugUIOnly() {
    window.DEBUGGER_STATE.instruction = null;
    window.onDebuggerStateChange?.();
  }

  function resetStepDebugUI() {
    window.DEBUGGER_STATE.status = 'STANDBY';
    window.DEBUGGER_STATE.instruction = null;
    window.onDebuggerStateChange?.();
  }

  // 步骤 1：对话文本按 Big5 双字节重新对齐解码，避免脚本详情出现乱码。
  function decodeChineseMsg(msgId) {
    if (!loadMsgFn) {
      return '正在加载文本...';
    }

    try {
      const text = loadMsgFn(msgId);
      if (!text) {
        return '无内容';
      }

      const bytes = [];
      for (let i = 0; i < text.length; i++) {
        const byte = text.getByte(i);
        if (byte === 34 || byte === 45 || byte === 39) {
          continue;
        }

        if (byte > 0x80) {
          if (i + 1 < text.length) {
            bytes.push(byte);
            bytes.push(text.getByte(i + 1));
            i++;
          }
          continue;
        }

        bytes.push(byte);
      }

      const decodedStr = big5Decoder.decode(new Uint8Array(bytes)).trim();
      return toSimplifiedFn ? toSimplifiedFn(decodedStr) : decodedStr;
    } catch (error) {
      return '文本解码失败';
    }
  }

  // 步骤 2：根据脚本 opcode 生成调试面板和日志区共用的高层解释文本。
  function getInstructionDetail(code, p1, p2, p3) {
    switch (code) {
      case 0xFFFF:
        return `💬 人物对话: "${decodeChineseMsg(p1)}"`;

      case 0x15: {
        const roleName = p3 === 0 ? '李逍遥' : `队员 #${p3}`;
        const dirs = { 0: '下', 1: '左', 2: '上', 3: '右' };
        return `🏃 【${roleName}】朝${dirs[p1] || p1} | 动作帧: 第 ${p2} 帧`;
      }

      case 0x65: {
        const roleName = p1 === 0 ? '李逍遥' : `队员 #${p1}`;
        return `👤 【${roleName}】切换新形象 ID: 0x${p2.toString(16).toUpperCase()}`;
      }

      case 0x46:
        return `📍 【位置定位】主角传送至瓦片坐标: (${p1}, ${p2}) | half: ${p3}`;

      case 0x16: {
        const dirs = { 0: '下', 1: '左', 2: '上', 3: '右' };
        return `👾 【NPC #${p1}】朝${dirs[p2] || p2} | 动作帧: 第 ${p3} 帧`;
      }

      case 0x49: {
        let stateDesc = `${p2}-未知`;
        if (p2 === 0) stateDesc = '0-Hidden (隐藏)';
        else if (p2 === 1) stateDesc = '1-Active (活跃)';
        else if (p2 === 2) stateDesc = '2-Auto (自动循环)';
        return `⚡ 【NPC #${p1}】生命活动状态变更 ➔ ${stateDesc}`;
      }

      case 0x85:
        return `⏱️ 【线程等待】挂起 ${p1} 帧 (约 ${Math.round(p1 * 160)} 毫秒)`;

      case 0x1E:
        return `🪙 【金钱变动】国库收支 ${p1 > 0 ? '+' : ''}${p1} 文钱`;

      case 0x1F:
        return `🎒 【获得物品】李逍遥获得 道具 #${p1}`;

      case 0x59:
        return `🔮 【传送设定】目的地设定 ➔ Scene #${p1}`;

      case 0x24:
        return `👾 【NPC #${p1}】绑定并启动自动脚本: Script #${p2}`;

      case 0x25:
        return `👾 【NPC #${p1}】配置交互触发脚本: Script #${p2}`;

      case 0x6E:
        return `🏃 【主角平移】像素偏移: (dx: ${p1}, dy: ${p2})`;

      case 0x6C:
        return `👾 【NPC #${p1}】像素平移: (dx: ${p2}, dy: ${p3})`;

      case 0x3C:
        return `💬 【气泡设定】顶部显示对话 (关联 NPC #${p1})`;

      case 0x3D:
        return `💬 【气泡设定】底部显示对话 (关联 NPC #${p1})`;

      case 0x3E:
        return `💬 【系统提示】弹出对话信息 (消息 ID: ${p1})`;

      case 0x8E:
        return '🧹 【清理视口】清空/重置对话框画面';

      default:
        return '';
    }
  }

  // 步骤 3：当底层线程被单步拦截时，保存 Promise 解决器并更新全局调试状态以通知 UI
  window.onStepDebugPause = async (thread) => {
    window.ACTIVE_DEBUG_THREAD = thread;

    const state = window.state;
    if (!state) {
      return;
    }

    const script = state.scripts[thread.scriptId];
    if (!script) {
      return;
    }

    const { scriptCodes } = await import('../js/engine/command.js');
    const codeObj = scriptCodes[script.code];
    const desc = codeObj ? codeObj.desc : '未知指令';
    const detailInfo = getInstructionDetail(script.code, script.param1, script.param2, script.param3);
    const displayDesc = detailInfo ? `${desc} ➔ ${detailInfo}` : desc;

    // 更新全局调试状态
    window.DEBUGGER_STATE.status = 'PAUSED';
    window.DEBUGGER_STATE.instruction = {
      ip: thread.scriptId,
      code: '0x' + script.code.toString(16).toUpperCase(),
      desc: displayDesc,
      params: `${script.param1}, ${script.param2}, ${script.param3}`
    };

    // 触发 React 状态同步
    window.onDebuggerStateChange?.();

    // 返回一个等待单步操作解决的 Promise，实现异步挂起
    return new Promise((resolve) => {
      currentResolve = resolve;
    });
  };

  // 步骤 4：定义核心的单步拦截切换、单步步进、恢复运行及停止断点操作
  function toggleStepDebug(enabled) {
    window.STEP_DEBUG = enabled;
    window.DEBUGGER_STATE.enabled = enabled;
    console.log(`[Debugger]: Step Debug Mode set to ${enabled}`);

    if (!enabled) {
      resolveBreakpoint();
      resetStepDebugUI();
      return;
    }

    window.DEBUGGER_STATE.status = 'STANDBY';
    window.DEBUGGER_STATE.instruction = null;
    window.onDebuggerStateChange?.();
  }

  function executeNextStep() {
    resolveBreakpoint();
  }

  function resumeRunning() {
    toggleStepDebug(false);
  }

  function stopBreakpoint() {
    resolveBreakpoint('stop');
    resetStepDebugUI();
  }

  window.toggleStepDebug = toggleStepDebug;
  window.executeNextStep = executeNextStep;
  window.resumeRunning = resumeRunning;
  window.stopBreakpoint = stopBreakpoint;
  window.getInstructionDetail = getInstructionDetail;

  return {
    getInstructionDetail
  };
}
