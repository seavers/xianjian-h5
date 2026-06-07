export function initStepDebugger() {
  window.STEP_DEBUG = false;
  window.ACTIVE_DEBUG_THREAD = null;

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
    document.getElementById('step-instruction-box').style.display = 'none';
    document.getElementById('btn-next-step').disabled = true;
    document.getElementById('btn-resume-run').disabled = true;
  }

  function resetStepDebugUI() {
    resetStepDebugUIOnly();
    document.getElementById('step-dbg-indicator').innerText = '● 待命 (STANDBY)';
    document.getElementById('step-dbg-indicator').style.color = 'rgba(255,255,255,0.3)';
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

  // 步骤 3：当底层线程被单步拦截时，实时填充调试面板并点亮控制按钮。
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

    document.getElementById('step-ip').innerText = thread.scriptId;
    document.getElementById('step-code').innerText = '0x' + script.code.toString(16).toUpperCase();
    document.getElementById('step-desc').innerText = displayDesc;
    document.getElementById('step-params').innerText = `${script.param1}, ${script.param2}, ${script.param3}`;
    document.getElementById('step-instruction-box').style.display = 'block';
    document.getElementById('step-dbg-indicator').innerText = '● 拦截 (PAUSED)';
    document.getElementById('step-dbg-indicator').style.color = 'var(--glow-yellow)';
    document.getElementById('btn-next-step').disabled = false;
    document.getElementById('btn-resume-run').disabled = false;
  };

  function toggleStepDebug(enabled) {
    window.STEP_DEBUG = enabled;
    console.log(`[Debugger]: Step Debug Mode set to ${enabled}`);

    if (!enabled) {
      if (window.ACTIVE_DEBUG_THREAD) {
        const thread = window.ACTIVE_DEBUG_THREAD;
        window.ACTIVE_DEBUG_THREAD = null;
        thread.notify();
      }
      resetStepDebugUI();
      return;
    }

    document.getElementById('step-dbg-indicator').innerText = '● 待命 (STANDBY)';
    document.getElementById('step-dbg-indicator').style.color = 'rgba(255,255,255,0.3)';
  }

  function executeNextStep() {
    if (!window.ACTIVE_DEBUG_THREAD) {
      return;
    }

    const thread = window.ACTIVE_DEBUG_THREAD;
    resetStepDebugUIOnly();
    thread.step();

    if (thread.finish || !window.STEP_DEBUG) {
      resetStepDebugUI();
    }
  }

  function resumeRunning() {
    document.getElementById('check-step-debug').checked = false;
    toggleStepDebug(false);
  }

  window.toggleStepDebug = toggleStepDebug;
  window.executeNextStep = executeNextStep;
  window.resumeRunning = resumeRunning;
  window.getInstructionDetail = getInstructionDetail;

  return {
    getInstructionDetail
  };
}
