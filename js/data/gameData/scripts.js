import { loadMsg } from '../../resources/pal.js';

const big5Decoder = new TextDecoder('big5');

const commandNameMap = {
  0xFFFF: 'DIALOGUE',
  0x15: 'ROLE_FACE',
  0x65: 'ROLE_IMAGE',
  0x46: 'TELEPORT',
  0x16: 'NPC_FACE',
  0x49: 'NPC_STATE',
  0x85: 'WAIT',
  0x1E: 'MONEY_MOD',
  0x1F: 'ITEM_GET',
  0x59: 'SCENE_DEST',
  0x24: 'NPC_AUTO_SCR',
  0x25: 'NPC_TRIG_SCR',
  0x6E: 'ROLE_MOVE_PX',
  0x6C: 'NPC_MOVE_PX',
  0x3C: 'SPEECH_TOP',
  0x3D: 'SPEECH_BOTTOM',
  0x3E: 'SYS_TIPS',
  0x8E: 'CLEAR_TEXT'
};

export function decodeChineseMsg(msgId) {
  try {
    const text = loadMsg(msgId);
    if (!text) return `文本 #${msgId}`;

    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const currentByte = text.getByte(i);
      if (currentByte === 34 || currentByte === 45 || currentByte === 39) {
        continue;
      }

      if (currentByte > 0x80 && i + 1 < text.length) {
        bytes.push(currentByte);
        bytes.push(text.getByte(i + 1));
        i++;
      } else {
        bytes.push(currentByte);
      }
    }

    const decodedStr = big5Decoder.decode(new Uint8Array(bytes)).trim();
    const simplifiedFn = window.toSimplifiedFn;
    return simplifiedFn ? simplifiedFn(decodedStr) : decodedStr;
  } catch (error) {
    return `消息 #${msgId}`;
  }
}

export function getInstructionChineseDetail(code, p1, p2, p3) {
  switch (code) {
    case 0xFFFF:
      return `💬 对话内容: "${decodeChineseMsg(p1)}"`;
    case 0x15: {
      const dirs = { 0: '下', 1: '左', 2: '上', 3: '右' };
      const roleName = p3 === 0 ? '李逍遥' : `队员 #${p3}`;
      return `🏃 【${roleName}】朝 ${dirs[p1] || p1} | 动作帧: 第 ${p2} 帧`;
    }
    case 0x65: {
      const roleName = p1 === 0 ? '李逍遥' : `队员 #${p1}`;
      return `👤 【${roleName}】切换新形象 ID: 0x${p2.toString(16).toUpperCase()}`;
    }
    case 0x46:
      return `📍 【传送】主角瞬间移动至坐标: (${p1}, ${p2}) | half: ${p3}`;
    case 0x16: {
      const npcDirs = { 0: '下', 1: '左', 2: '上', 3: '右' };
      return `👾 【NPC #${p1}】转向朝 ${npcDirs[p2] || p2} | 动作帧: 第 ${p3} 帧`;
    }
    case 0x49: {
      let stateDesc = `${p2}-未知`;
      if (p2 === 0) stateDesc = '0-Hidden (隐藏)';
      else if (p2 === 1) stateDesc = '1-Active (活跃)';
      else if (p2 === 2) stateDesc = '2-Auto (自动循环)';
      return `⚡ 【NPC #${p1}】生命活动状态变更为 ➔ ${stateDesc}`;
    }
    case 0x85:
      return `⏱️ 【延迟】挂起线程等待 ${p1} 帧 (约 ${Math.round(p1 * 160)} 毫秒)`;
    case 0x1E: {
      const sign = p1 > 0 ? '+' : '';
      return `🪙 【金钱】国库收支变动 ${sign}${p1} 文钱`;
    }
    case 0x1F:
      return `🎒 【给予道具】获得 道具 #${p1}`;
    case 0x59:
      return `🔮 【目的地】新场景转移目的地 ➔ Scene #${p1}`;
    case 0x24:
      return `👾 【NPC #${p1}】绑定并运行自动循环脚本: Script #${p2}`;
    case 0x25:
      return `👾 【NPC #${p1}】绑定交互触发执行脚本: Script #${p2}`;
    case 0x6E:
      return `🏃 【主角平移】像素级别平滑偏移: (dx: ${p1}, dy: ${p2})`;
    case 0x6C:
      return `👾 【NPC #${p1}】像素平移: (dx: ${p2}, dy: ${p3})`;
    case 0x3C:
      return `💬 【气泡对话】顶部弹出对话泡 (NPC #${p1})`;
    case 0x3D:
      return `💬 【气泡对话】底部弹出对话泡 (NPC #${p1})`;
    case 0x3E:
      return `💬 【系统通知】弹出居中消息框 (消息 ID: ${p1})`;
    case 0x8E:
      return `🧹 【清屏】清空并隐藏所有的对话与输入窗口`;
    default:
      return '';
  }
}

export function getCommandName(code) {
  return commandNameMap[code] || `CMD_0x${code.toString(16).toUpperCase()}`;
}
