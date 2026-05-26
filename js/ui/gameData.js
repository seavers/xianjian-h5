// ==================== 📚 仙剑实时游戏资料与联动调试系统核心逻辑 ====================

import { loadRgm, loadMgo, loadGop, loadBall, loadMgoCount, loadMsg, loadFbp } from '../resources/pal.js';
import { state } from '../engine/state.js';
import { scriptCodes } from '../engine/command.js';

// 1. 全局配置：剧中角色属性高级元数据库
const ROLES_DB = {
  0: {
    name: '李逍遥',
    rgmId: 0,
    mgoRoleId: 2,
    level: 99,
    hp: '999/999',
    mp: '700/700',
    atk: 650,
    def: 480,
    spd: 350,
    lck: 290,
    mag: 580,
    status: '正常',
    equip: {
      weapon: '无极宝剑 (+120 武)',
      armor: '天蚕宝甲 (+85 防)',
      helmet: '冲天冠 (+30 防)',
      cape: '九阴披风 (+40 防)',
      shoes: '魅影神靴 (+60 速)',
      accessory: '乾坤镜 (+50 灵)'
    },
    spells: ['御剑术', '万剑诀', '天师符', '剑神', '醉仙望月步', '仙风云体术', '乾坤一掷']
  },
  1: {
    name: '赵灵儿',
    rgmId: 11,
    mgoRoleId: 3,
    level: 99,
    hp: '850/850',
    mp: '999/999',
    atk: 420,
    def: 410,
    spd: 380,
    lck: 220,
    mag: 990,
    status: '正常',
    equip: {
      weapon: '凤鸣刀 (+85 武, +20 灵)',
      armor: '五彩衣 (+60 防)',
      helmet: '天蚕丝带 (+20 防)',
      cape: '无',
      shoes: '莲花靴 (+30 速)',
      accessory: '玉佛珠 (+80 灵)'
    },
    spells: ['旋风咒', '风卷残云', '五雷咒', '狂雷', '冰心诀', '观音咒', '还魂咒', '回梦']
  },
  2: {
    name: '林月如',
    rgmId: 20,
    mgoRoleId: 7,
    level: 99,
    hp: '920/920',
    mp: '500/500',
    atk: 710,
    def: 500,
    spd: 450,
    lck: 310,
    mag: 420,
    status: '正常',
    equip: {
      weapon: '金蛇鞭 (+100 武, +15 速)',
      armor: '金缕衣 (+75 防)',
      helmet: '凤冠 (+25 防)',
      cape: '无',
      shoes: '织女鞋 (+45 速)',
      accessory: '豹牙手环 (+30 武)'
    },
    spells: ['气疗术', '一阳指', '斩龙诀', '万里狂沙', '金刚咒', '乾坤一掷']
  },
  3: {
    name: '阿奴',
    rgmId: 27,
    mgoRoleId: 4,
    level: 99,
    hp: '880/880',
    mp: '800/800',
    atk: 480,
    def: 430,
    spd: 510,
    lck: 400,
    mag: 850,
    status: '正常',
    equip: {
      weapon: '巫月神刀 (+90 武, +40 灵)',
      armor: '苗衣 (+50 防)',
      helmet: '银发卡 (+15 防)',
      cape: '无',
      shoes: '绣花皮鞋 (+25 速)',
      accessory: '天蚕蛊 (+50 毒抗)'
    },
    spells: ['炎杀咒', '万蛊噬天', '夺魂', '赎魂', '元灵归心术']
  }
};

// 2. 局部及动画控制状态变量
let activeTab = 'role';
let selectedRoleId = 0;
let selectedNpcId = 1;
let selectedSceneId = 1;
let selectedScriptId = 0;

let npcFilterKeyword = '';
let heroAnimInterval = null;
let currentHeroAnimFrame = 0;
let isHeroAnimPlaying = true;

// 3. 对话与文字反解相关静态资源
const big5Decoder = new TextDecoder('big5');

// ==================== 🛠️ 通用工具函数 ====================

// 简易 Big5 解码以配合指令反解
function decodeChineseMsg(msgId) {
  try {
    const text = loadMsg(msgId);
    if (!text) return '文本 #' + msgId;
    
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const b = text.getByte(i);
      if (b === 34 || b === 45 || b === 39) continue;
      if (b > 0x80 && i + 1 < text.length) {
        bytes.push(b);
        bytes.push(text.getByte(i + 1));
        i++;
      } else {
        bytes.push(b);
      }
    }
    
    const decodedStr = big5Decoder.decode(new Uint8Array(bytes)).trim();
    
    // 如果存在简中转换，尝试调用
    const simplifiedFn = window.toSimplifiedFn;
    return simplifiedFn ? simplifiedFn(decodedStr) : decodedStr;
  } catch (e) {
    return '消息 #' + msgId;
  }
}

// 核心指令翻译反解
function getInstructionChineseDetail(code, p1, p2, p3) {
  switch (code) {
    case 0xFFFF:
      return `💬 对话内容: "${decodeChineseMsg(p1)}"`;
    case 0x15: {
      const roleName = p3 === 0 ? '李逍遥' : `队员 #${p3}`;
      const dirs = { 0: '下', 1: '左', 2: '上', 3: '右' };
      return `🏃 【${roleName}】朝 ${dirs[p1] || p1} | 动作帧: 第 ${p2} 帧`;
    }
    case 0x65: {
      const roleName2 = p1 === 0 ? '李逍遥' : `队员 #${p1}`;
      return `👤 【${roleName2}】切换新形象 ID: 0x${p2.toString(16).toUpperCase()}`;
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

// 翻译指令名称 (以 0xXX 开头的极客描述)
function getCommandName(code) {
  const codes = {
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
  return codes[code] || `CMD_0x${code.toString(16).toUpperCase()}`;
}

// 防糊像素画居中渲染
function drawPixelated(srcCanvas, destCanvasId) {
  const destCanvas = document.getElementById(destCanvasId);
  if (!destCanvas) return;
  
  const ctx = destCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);
  
  if (srcCanvas) {
    const scale = Math.min(destCanvas.width / srcCanvas.width, destCanvas.height / srcCanvas.height);
    const cleanScale = Math.max(0.5, Math.floor(scale));
    
    const dx = (destCanvas.width - srcCanvas.width * cleanScale) / 2;
    const dy = (destCanvas.height - srcCanvas.height * cleanScale) / 2;
    
    ctx.drawImage(srcCanvas, dx, dy, srcCanvas.width * cleanScale, srcCanvas.height * cleanScale);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.strokeRect(4, 4, destCanvas.width - 8, destCanvas.height - 8);
  }
}

// 角色动作包的角色名
function getRoleName(roleId) {
  if (roleId <= 0) {
    return "-";
  }
  const names = {
    // 0: '李逍遥',
    // 1: '赵灵儿',
    // 2: '林月如',
    // 3: '阿奴',
    // 4: '赵灵儿(蛇)',
    // 10: '李大娘',
    // 11: '苗人首领',
    // 12: '苗人手下',
    // 21: '村口黄狗',
    // 53: '集市商贩'
  };
  return names[roleId] || `人物 #${roleId}`;
}

// 替换脚本ID为高亮可点击超链接
function makeScriptHyperlinks(text) {
  if (!text) return '';
  return text.replace(/Script\s*#(\d+)/g, (match, id) => {
    return `<span class="script-data-link" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;" onclick="jumpToGameDataScript(${id})">${match}</span>`;
  });
}

// ==================== 🚀 弹窗开闭与大 TAB 切换入口 ====================

export function openGameDataModal() {
  document.getElementById('game-data-modal').style.display = 'flex';
  switchGameDataTab(activeTab);
}

export function closeGameDataModal() {
  document.getElementById('game-data-modal').style.display = 'none';
  stopHeroAnimClock();
}

export function switchGameDataTab(tabName) {
  activeTab = tabName;
  stopHeroAnimClock();

  // 选项卡切换样式高亮
  document.querySelectorAll('.gamedata-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'rgba(255,255,255,0.6)';
    btn.style.borderColor = 'rgba(255,255,255,0.06)';
  });
  const activeTabBtn = document.getElementById(`gamedata-tab-${tabName}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
    activeTabBtn.style.color = 'var(--glow-yellow)';
    activeTabBtn.style.borderColor = 'var(--glow-yellow)';
  }

  // 渲染主体内容
  const mainContainer = document.getElementById('gamedata-main-container');
  if (tabName === 'role') {
    renderRoleTab(mainContainer);
  } else if (tabName === 'npc') {
    renderNpcTab(mainContainer);
  } else if (tabName === 'script') {
    renderScriptTab(mainContainer);
  } else if (tabName === 'scene') {
    renderSceneTab(mainContainer);
  }
}

// ==================== 👤 TAB 1: 角色信息渲染逻辑 ====================

function renderRoleTab(container) {
  // 左侧角色列表
  let leftHtml = `
    <div style="width: 260px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">👤 剧中角色列表</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  Object.keys(ROLES_DB).forEach(id => {
    const roleId = parseInt(id);
    const r = ROLES_DB[roleId];
    const isSelected = selectedRoleId === roleId;
    leftHtml += `
      <div data-role-item="${roleId}" onclick="onGameDataRoleSelect(${roleId})" style="padding: 8px 12px; background: ${isSelected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? 'var(--glow-yellow)' : '#fff'};">${r.name}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">LV ${r.level}</span>
      </div>
    `;
  });

  leftHtml += `
      </div>
    </div>
  `;

  // 右侧角色高级详情
  const r = ROLES_DB[selectedRoleId];
  const rightHtml = `
    <div data-role-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      ${buildRoleRightHtml(r)}
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;

  // 延迟微秒开始在 Canvas 上绘制经典复古像素图以防止渲染失败
  setTimeout(() => {
    try {
      const rgmImg = loadRgm(r.rgmId);
      if (rgmImg) {
        drawPixelated(rgmImg, 'canvas-role-rgm');
      }
    } catch (e) {
      console.error('加载头像失败:', e);
    }
    
    startHeroAnimClock(r.mgoRoleId);
  }, 30);
}

export function onGameDataRoleSelect(roleId) {
  selectedRoleId = roleId;
  updateRoleSelection();
}

// 动态切换角色列表选中样式并仅刷新右侧详情
function updateRoleSelection() {
  const container = document.getElementById('gamedata-main-container');
  // 清除旧选中样式
  container.querySelectorAll('[data-role-item]').forEach(el => {
    el.style.background = 'rgba(255,255,255,0.015)';
    el.style.borderColor = 'rgba(255,255,255,0.03)';
    const span = el.querySelector('span');
    if (span) span.style.color = '#fff';
  });
  // 设置新选中样式
  const activeEl = container.querySelector(`[data-role-item="${selectedRoleId}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.08)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    const span = activeEl.querySelector('span');
    if (span) span.style.color = 'var(--glow-yellow)';
  }
  // 只重建右侧详情区
  const rightPanel = container.querySelector('[data-role-right]');
  if (rightPanel) {
    const r = ROLES_DB[selectedRoleId];
    rightPanel.innerHTML = buildRoleRightHtml(r);
    setTimeout(() => {
      try {
        const rgmImg = loadRgm(r.rgmId);
        if (rgmImg) drawPixelated(rgmImg, 'canvas-role-rgm');
      } catch (e) { console.error('加载头像失败:', e); }
      startHeroAnimClock(r.mgoRoleId);
    }, 30);
  }
}

// 构建角色右侧详情 HTML（从 renderRoleTab 抽取）
function buildRoleRightHtml(r) {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 14px; color: var(--glow-yellow); font-weight: bold; text-shadow: 0 0 10px rgba(255,215,0,0.2);">${r.name}</h2>
        <span style="font-size: 8px; background: rgba(0, 255, 157, 0.1); border: 1px solid rgba(0,255,157,0.3); color: var(--glow-green); padding: 1px 4px; border-radius: 1px; font-weight: bold;">主力队员</span>
      </div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.4); font-weight: bold;">当前携带资金: <span style="color: var(--glow-yellow);">${state.money || 0} 文</span></div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🖼️ 经典角色头像 (RGM)</span>
        <canvas id="canvas-role-rgm" width="80" height="80" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 5px;">🏃 2D 走动像素立绘 (MGO)</span>
        <canvas id="canvas-role-mgo" width="60" height="138" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <button id="btn-hero-anim-play" onclick="toggleHeroAnim()" class="btn-dbg" style="color: var(--glow-green); border-color: rgba(0,255,157,0.2); padding: 2px 8px; font-size: 8px; cursor: pointer; font-weight: bold;">⏸ 暂停走动</button>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 角色基础属性</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">等级 (LV)</div><div style="font-size: 10px; color: var(--glow-yellow); font-weight: bold;">LV ${r.level}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">体力 (HP)</div><div style="font-size: 10px; color: #ff5777; font-weight: bold;">${r.hp}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">真气 (MP)</div><div style="font-size: 10px; color: #4db3ff; font-weight: bold;">${r.mp}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">武术 (ATK)</div><div style="font-size: 10px; color: #ffa64d; font-weight: bold;">${r.atk}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">灵力 (MAG)</div><div style="font-size: 10px; color: #b366ff; font-weight: bold;">${r.mag}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">防御 (DEF)</div><div style="font-size: 10px; color: #00ffaa; font-weight: bold;">${r.def}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">身法 (SPD)</div><div style="font-size: 10px; color: #00e5ff; font-weight: bold;">${r.spd}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">吉运 (LCK)</div><div style="font-size: 10px; color: #ffff00; font-weight: bold;">${r.lck}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">状态 (STATUS)</div><div style="font-size: 10px; color: var(--glow-green); font-weight: bold;">${r.status}</div></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 配备神兵防具</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">⚔ 武器</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${r.equip.weapon}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">🛡 身体防具</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${r.equip.armor}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">👒 头部防护</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${r.equip.helmet}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">🥾 足踏奇鞋</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${r.equip.shoes}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 精通绝学仙术</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">${r.spells.map(s => `<span style="font-size: 8px; color: #dfb3ff; background: rgba(179,102,255,0.1); border: 1px solid rgba(179,102,255,0.3); padding: 2px 6px; border-radius: 2px; font-weight:bold;">✨ ${s}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

export function toggleHeroAnim() {
  isHeroAnimPlaying = !isHeroAnimPlaying;
  const btn = document.getElementById('btn-hero-anim-play');
  if (btn) {
    btn.innerText = isHeroAnimPlaying ? '⏸ 暂停走动' : '▶ 播放走动';
    btn.style.color = isHeroAnimPlaying ? 'var(--glow-green)' : 'var(--glow-yellow)';
  }
}

function startHeroAnimClock(mgoRoleId) {
  stopHeroAnimClock();
  
  let mgoCount = 4;
  try {
    mgoCount = loadMgoCount(mgoRoleId);
    if (mgoCount <= 0) mgoCount = 4;
  } catch (e) {
    mgoCount = 4;
  }

  const renderFrame = () => {
    try {
      const frameCanvas = loadMgo(mgoRoleId, currentHeroAnimFrame);
      if (frameCanvas) {
        drawPixelated(frameCanvas, 'canvas-role-mgo');
      }
    } catch (e) {
      // 容错
    }
  };

  renderFrame(); // 初始帧
  
  heroAnimInterval = setInterval(() => {
    if (!isHeroAnimPlaying) return;
    currentHeroAnimFrame = (currentHeroAnimFrame + 1) % mgoCount;
    renderFrame();
  }, 180);
}

function stopHeroAnimClock() {
  if (heroAnimInterval) {
    clearInterval(heroAnimInterval);
    heroAnimInterval = null;
  }
}

// ==================== 👾 TAB 2: NPC 信息渲染逻辑 ====================

function renderNpcTab(container) {
  // 获取活跃的 NPC 事件列表
  const npcs = [];
  for (let i = 1; i < state.eventObjects.length; i++) {
    const o = state.eventObjects[i];
    if (o && o.type === 'npc') {
      npcs.push(o);
    }
  }

  // 过滤模糊匹配
  const filteredNpcs = npcs.filter(npc => {
    const name = getRoleName(npc.roleId);
    const searchStr = `${npc.id} ${npc.roleId} ${name}`.toLowerCase();
    return searchStr.indexOf(npcFilterKeyword.toLowerCase()) !== -1;
  });

  // 左侧 NPC 检索栏与列表
  let leftHtml = `
    <div style="width: 280px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">👾 全局 NPC 列表 (共 ${npcs.length} 个)</span>
        <input type="text" id="input-gamedata-npc-filter" oninput="searchGameDataNpc(this.value)" value="${npcFilterKeyword}" placeholder="输入 ID 或角色名搜索..." style="background: #0c0a08; border: 1px solid rgba(255,215,0,0.2); color: #fff; font-size: 8px; padding: 3px 6px; outline: none; border-radius: 2px;">
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  if (filteredNpcs.length === 0) {
    leftHtml += `<div style="text-align: center; color: rgba(255,255,255,0.2); font-size: 8.5px; padding-top: 20px;">未找到匹配的 NPC</div>`;
  } else {
    filteredNpcs.forEach(npc => {
      const isSelected = selectedNpcId === npc.id;
      const roleName = getRoleName(npc.roleId);
      leftHtml += `
        <div data-npc-item="${npc.id}" onclick="onGameDataNpcSelect(${npc.id})" style="padding: 6px 10px; background: ${isSelected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.012)'}; border: 1px solid ${isSelected ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; border-radius: 2px; cursor: pointer; display: flex; flex-direction: column; transition: all 0.12s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? 'var(--glow-yellow)' : '#fff'};">🤖 NPC #${npc.id}</span>
            <span style="font-size: 7.5px; color: rgba(255,255,255,0.3);">Dir: ${npc.dir}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
            <span style="font-size: 8px; color: var(--glow-green);">${roleName}</span>
            <span style="font-size: 8px; color: rgba(255,255,255,0.35);">(${npc.x}, ${npc.y})</span>
          </div>
        </div>
      `;
    });
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 右侧 NPC 详情信息剖析
  const npc = state.eventObjects[selectedNpcId] || filteredNpcs[0];
  let rightHtml = '';

  if (!npc) {
    rightHtml = `
      <div data-npc-right style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); font-size: 10px;">
        请在左侧选择一个 NPC 进行深度分析
      </div>
    `;
  } else {
    const roleName = getRoleName(npc.roleId);
    
    // 脚本高亮超链接渲染
    const trigScrHtml = npc.trigScr > 0 
      ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.trigScr} ➔ 点击反解</span>`
      : '<span style="color: rgba(255,255,255,0.25);">无触发脚本 (0)</span>';

    const autoScrHtml = npc.autoScr > 0 
      ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.autoScr} ➔ 点击反解</span>`
      : '<span style="color: rgba(255,255,255,0.25);">无自动脚本 (0)</span>';

    rightHtml = `
      <div data-npc-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">👾 NPC #${npc.id} [${roleName}] 的运行时状态分析</h2>
          </div>
        </div>

        <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
          <!-- 动作图元解码 -->
          <div style="width: 180px; display: flex; flex-direction: column; gap: 8px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
            <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">👾 原生 2D 像素精灵图</span>
            <canvas id="canvas-npc-mgo" width="100" height="100" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
            <div style="font-size: 7.5px; color: rgba(255,255,255,0.3); text-align: center; line-height: 1.3; margin-top: 4px;">
              动作包: mgo.mkf #${npc.roleId}<br>
              当前帧数: Frame #${npc.frame}<br>
              像素尺寸: <span id="label-npc-mgo-size" style="color:var(--glow-yellow);">--x--</span>
            </div>
          </div>

          <!-- 底牌元数据表格 -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
            <div>
              <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 二进制核心事件物体属性 (EventObject Profile)
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片横坐标 (mx)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.x}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片纵坐标 (my)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.y}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">图层高度 (layer)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.layer}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">初始朝向 (dir)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.dir === 0 ? '下 (0)' : npc.dir === 1 ? '左 (1)' : npc.dir === 2 ? '上 (2)' : '右 (3)'}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">动作包 ID (roleId)</span>
                  <span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">${npc.roleId} (${roleName})</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">当前图元帧 (frame)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.frame}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">生命活动状态 (state)</span>
                  <span style="font-size: 9px; color: var(--glow-yellow); font-weight: bold;">${npc.state === 0 ? '0 (隐藏)' : npc.state === 1 ? '1 (活跃)' : '2 (自动循环)'}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">触发模式 (trigMode)</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.trigMode}</span>
                </div>
              </div>
            </div>

            <!-- 绑定的脚本 -->
            <div>
              <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 绑定脚本事件指针 (点击立即穿梭反解)
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.35);">🔍 交互触发脚本 (trigScr)</span>
                  <span style="font-size: 8.5px;">${trigScrHtml}</span>
                </div>
                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.35);">🤖 自动心跳脚本 (autoScr)</span>
                  <span style="font-size: 8.5px;">${autoScrHtml}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = leftHtml + rightHtml;

  // 绘制 NPC 经典立绘
  if (npc && npc.roleId) {
    setTimeout(() => {
      try {
        const npcCanvas = loadMgo(npc.roleId, npc.frame);
        if (npcCanvas) {
          drawPixelated(npcCanvas, 'canvas-npc-mgo');
          const sizeLabel = document.getElementById('label-npc-mgo-size');
          if (sizeLabel) {
            sizeLabel.innerText = `${npcCanvas.width}x${npcCanvas.height} px`;
          }
        }
      } catch (e) {
        console.error('绘制 NPC 像素精灵图失败:', e);
      }
    }, 30);
  }
}

export function onGameDataNpcSelect(npcId) {
  selectedNpcId = npcId;
  updateNpcSelection();
}

// 动态切换 NPC 列表选中样式并仅刷新右侧详情
function updateNpcSelection() {
  const container = document.getElementById('gamedata-main-container');
  // 清除旧选中样式
  container.querySelectorAll('[data-npc-item]').forEach(el => {
    el.style.background = 'rgba(255,255,255,0.012)';
    el.style.borderColor = 'rgba(255,255,255,0.02)';
    const spans = el.querySelectorAll('div > span:first-child');
    spans.forEach(s => { if (s.innerText.startsWith('🤖')) s.style.color = '#fff'; });
  });
  // 设置新选中样式
  const activeEl = container.querySelector(`[data-npc-item="${selectedNpcId}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.08)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    const spans = activeEl.querySelectorAll('div > span:first-child');
    spans.forEach(s => { if (s.innerText.startsWith('🤖')) s.style.color = 'var(--glow-yellow)'; });
  }
  // 只重建右侧详情区
  const rightPanel = container.querySelector('[data-npc-right]');
  if (rightPanel) {
    const npc = state.eventObjects[selectedNpcId];
    if (npc && npc.roleId) {
      rightPanel.innerHTML = buildNpcRightHtml(npc);
      setTimeout(() => {
        try {
          const npcCanvas = loadMgo(npc.roleId, npc.frame);
          if (npcCanvas) {
            drawPixelated(npcCanvas, 'canvas-npc-mgo');
            const sizeLabel = document.getElementById('label-npc-mgo-size');
            if (sizeLabel) sizeLabel.innerText = `${npcCanvas.width}x${npcCanvas.height} px`;
          }
        } catch (e) { console.error('绘制 NPC 像素精灵图失败:', e); }
      }, 30);
    }
  }
}

export function searchGameDataNpc(val) {
  npcFilterKeyword = val;
  const mainContainer = document.getElementById('gamedata-main-container');
  renderNpcTab(mainContainer);
  // 保持焦点在输入框上
  const input = document.getElementById('input-gamedata-npc-filter');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

export function jumpToGameDataNpc(npcId) {
  selectedNpcId = npcId;
  npcFilterKeyword = '';
  // 若已在 NPC Tab，直接动态切换
  if (activeTab === 'npc') {
    updateNpcSelection();
  } else {
    switchGameDataTab('npc');
  }
}

// 构建 NPC 右侧详情 HTML
function buildNpcRightHtml(npc) {
  const roleName = getRoleName(npc.roleId);
  const trigScrHtml = npc.trigScr > 0 
    ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.trigScr} ➔ 点击反解</span>`
    : '<span style="color: rgba(255,255,255,0.25);">无触发脚本 (0)</span>';
  const autoScrHtml = npc.autoScr > 0 
    ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.autoScr} ➔ 点击反解</span>`
    : '<span style="color: rgba(255,255,255,0.25);">无自动脚本 (0)</span>';
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">👾 NPC #${npc.id} [${roleName}] 的运行时状态分析</h2>
      </div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 8px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">👾 原生 2D 像素精灵图</span>
        <canvas id="canvas-npc-mgo" width="100" height="100" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.3); text-align: center; line-height: 1.3; margin-top: 4px;">动作包: mgo.mkf #${npc.roleId}<br>当前帧数: Frame #${npc.frame}<br>像素尺寸: <span id="label-npc-mgo-size" style="color:var(--glow-yellow);">--x--</span></div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 二进制核心事件物体属性 (EventObject Profile)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片横坐标 (mx)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.x}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片纵坐标 (my)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.y}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">图层高度 (layer)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.layer}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">初始朝向 (dir)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.dir === 0 ? '下 (0)' : npc.dir === 1 ? '左 (1)' : npc.dir === 2 ? '上 (2)' : '右 (3)'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">动作包 ID (roleId)</span><span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">${npc.roleId} (${roleName})</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">当前图元帧 (frame)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.frame}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">生命活动状态 (state)</span><span style="font-size: 9px; color: var(--glow-yellow); font-weight: bold;">${npc.state === 0 ? '0 (隐藏)' : npc.state === 1 ? '1 (活跃)' : '2 (自动循环)'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">触发模式 (trigMode)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.trigMode}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 绑定脚本事件指针 (点击立即穿梭反解)</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🔍 交互触发脚本 (trigScr)</span><span style="font-size: 8.5px;">${trigScrHtml}</span></div>
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🤖 自动心跳脚本 (autoScr)</span><span style="font-size: 8.5px;">${autoScrHtml}</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

// ==================== 📜 TAB 3: 脚本信息渲染逻辑 ====================

function renderScriptTab(container) {
  // 从选中的 Script ID 开始向下反解 20 条连续脚本指令
  const totalScripts = state.scripts.length;
  const listItems = [];
  const startId = selectedScriptId;
  const endId = Math.min(totalScripts, startId + 20);

  // 反解这 20 条连续指令
  for (let i = startId; i < endId; i++) {
    const s = state.scripts[i];
    if (s) {
      const codeHex = '0x' + s.code.toString(16).toUpperCase();
      const desc = getInstructionChineseDetail(s.code, s.param1, s.param2, s.param3);
      const cmdName = getCommandName(s.code);
      
      // 获取官方中文指令解释词条
      const codeObj = scriptCodes[s.code];
      const officialDesc = codeObj ? codeObj.desc : '未知系统底层指令';
      
      listItems.push({
        id: s.id,
        codeHex,
        cmdName,
        officialDesc,
        params: `${s.param1}, ${s.param2}, ${s.param3}`,
        desc: makeScriptHyperlinks(desc)
      });
    }
  }

  // 双栏排版
  let leftHtml = `
    <div style="width: 250px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">📜 脚本指令检索 (共 ${totalScripts} 条)</span>
        <div style="display:flex; gap:4px;">
          <input type="number" id="input-gamedata-script-id" value="${selectedScriptId}" min="0" max="${totalScripts - 1}" style="background: #0c0a08; border: 1px solid rgba(255,215,0,0.2); color: #fff; font-size: 8.5px; padding: 2px 4px; outline: none; border-radius: 2px; flex: 1; text-align: center;">
          <button onclick="searchGameDataScript()" class="btn-dbg" style="color: var(--glow-yellow); border-color: rgba(255,215,0,0.2); padding: 2px 6px; font-size: 8.5px; cursor: pointer; font-weight: bold;">一键反解</button>
        </div>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  // 渲染简易的索引侧边栏（以 20 为步长进行快速分页导航）
  for (let i = 0; i < totalScripts; i += 20) {
    const isCurrentRange = selectedScriptId >= i && selectedScriptId < i + 20;
    leftHtml += `
      <div data-script-item="${i}" onclick="jumpToGameDataScript(${i})" style="padding: 6px 8px; background: ${isCurrentRange ? 'rgba(255, 215, 0, 0.06)' : 'rgba(255,255,255,0.012)'}; border: 1px solid ${isCurrentRange ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; border-radius: 2px; cursor: pointer; font-size: 8px; color: ${isCurrentRange ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.4)'}; display:flex; justify-content:space-between; transition: all 0.1s;">
        <span>段落 #${i} ➔ #${Math.min(totalScripts - 1, i + 19)}</span>
        <span>${isCurrentRange ? '●' : ''}</span>
      </div>
    `;
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 右侧核心反解区
  let rightHtml = `
    <div data-script-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">📜 连续指令解析流 (从 ID #${selectedScriptId} 顺序向下解码)</h2>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
  `;

  listItems.forEach(item => {
    const isHighlight = item.id === selectedScriptId;
    rightHtml += `
      <div style="background: ${isHighlight ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; padding: 6px 12px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between; font-family:'JetBrains Mono', monospace; font-size: 8px; transition: all 0.15s; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span style="font-weight: bold; color: ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.35)'};">SCRIPT ID: #${item.id}</span>
          <span style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); padding: 1px 4px; border-radius: 2px;">${item.codeHex} (${item.cmdName})</span>
          <span style="color: var(--glow-green); font-weight: bold; text-transform: uppercase; background: rgba(0,255,157,0.06); border: 1px solid rgba(0,255,157,0.2); padding: 1px 4px; border-radius: 2px;">${item.officialDesc}</span>
          <span style="color: rgba(255,255,255,0.25);">Params: (${item.params})</span>
        </div>
        <div style="font-size: 9.5px; color: #fff; font-weight: 500; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.desc || ''}
        </div>
      </div>
    `;
  });

  rightHtml += `
      </div>
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;
}

export function jumpToGameDataScript(scriptId) {
  selectedScriptId = Math.max(0, Math.min(state.scripts.length - 1, parseInt(scriptId)));
  // 若已在脚本 Tab，直接动态切换
  if (activeTab === 'script') {
    updateScriptSelection();
  } else {
    switchGameDataTab('script');
  }
}

// 动态切换脚本段落选中样式并仅刷新右侧详情
function updateScriptSelection() {
  const container = document.getElementById('gamedata-main-container');
  // 清除旧选中样式
  container.querySelectorAll('[data-script-item]').forEach(el => {
    el.style.background = 'rgba(255,255,255,0.012)';
    el.style.borderColor = 'rgba(255,255,255,0.02)';
    el.style.color = 'rgba(255,255,255,0.4)';
    const dot = el.querySelectorAll('span')[1];
    if (dot) dot.innerText = '';
  });
  // 设置新选中样式
  const activeEl = container.querySelector(`[data-script-item="${Math.floor(selectedScriptId / 20) * 20}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.06)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    activeEl.style.color = 'var(--glow-yellow)';
    const dot = activeEl.querySelectorAll('span')[1];
    if (dot) dot.innerText = '●';
  }
  // 同步输入框
  const input = document.getElementById('input-gamedata-script-id');
  if (input) input.value = selectedScriptId;
  // 只重建右侧详情区
  const rightPanel = container.querySelector('[data-script-right]');
  if (rightPanel) {
    rightPanel.innerHTML = buildScriptRightHtml();
  }
}

// 构建脚本右侧详情 HTML
function buildScriptRightHtml() {
  const totalScripts = state.scripts.length;
  const listItems = [];
  const startId = selectedScriptId;
  const endId = Math.min(totalScripts, startId + 20);
  for (let i = startId; i < endId; i++) {
    const s = state.scripts[i];
    if (s) {
      const codeHex = '0x' + s.code.toString(16).toUpperCase();
      const desc = getInstructionChineseDetail(s.code, s.param1, s.param2, s.param3);
      const cmdName = getCommandName(s.code);
      const codeObj = scriptCodes[s.code];
      const officialDesc = codeObj ? codeObj.desc : '未知系统底层指令';
      listItems.push({ id: s.id, codeHex, cmdName, officialDesc, params: `${s.param1}, ${s.param2}, ${s.param3}`, desc: makeScriptHyperlinks(desc) });
    }
  }
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">📜 连续指令解析流 (从 ID #${selectedScriptId} 顺序向下解码)</h2>
      </div>
    </div>
    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
  `;
  listItems.forEach(item => {
    const isHighlight = item.id === selectedScriptId;
    html += `
      <div style="background: ${isHighlight ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; padding: 6px 12px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between; font-family:'JetBrains Mono', monospace; font-size: 8px; transition: all 0.15s; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span style="font-weight: bold; color: ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.35)'};">SCRIPT ID: #${item.id}</span>
          <span style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); padding: 1px 4px; border-radius: 2px;">${item.codeHex} (${item.cmdName})</span>
          <span style="color: var(--glow-green); font-weight: bold; text-transform: uppercase; background: rgba(0,255,157,0.06); border: 1px solid rgba(0,255,157,0.2); padding: 1px 4px; border-radius: 2px;">${item.officialDesc}</span>
          <span style="color: rgba(255,255,255,0.25);">Params: (${item.params})</span>
        </div>
        <div style="font-size: 9.5px; color: #fff; font-weight: 500; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.desc || ''}
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

export function searchGameDataScript() {
  const input = document.getElementById('input-gamedata-script-id');
  if (input) {
    const val = parseInt(input.value);
    if (!isNaN(val)) {
      selectedScriptId = Math.max(0, Math.min(state.scripts.length - 1, val));
      updateScriptSelection();
    }
  }
}

// ==================== 🗺️ TAB 4: 场景信息渲染逻辑 ====================

function renderSceneTab(container) {
  const scenes = [];
  for (let i = 1; i < state.scenes.length; i++) {
    const s = state.scenes[i];
    if (s) {
      scenes.push(s);
    }
  }

  // 左侧场景 Scene 列表
  let leftHtml = `
    <div style="width: 250px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">🗺️ 游戏场景 Scenes 目录</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  scenes.forEach(s => {
    const isSelected = selectedSceneId === s.sceneId;
    leftHtml += `
      <div data-scene-item="${s.sceneId}" onclick="onGameDataSceneSelect(${s.sceneId})" style="padding: 8px 12px; background: ${isSelected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.12s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? 'var(--glow-yellow)' : '#fff'};">Scene #${s.sceneId}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">Map 0x${s.mapId.toString(16).toUpperCase()}</span>
      </div>
    `;
  });

  leftHtml += `
      </div>
    </div>
  `;

  // 右侧场景及 NPC 关联列表详情
  const s = state.scenes[selectedSceneId] || scenes[0];
  let rightHtml = '';

  if (!s) {
    rightHtml = `
      <div data-scene-right style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); font-size: 10px;">
        请在左侧选择一个场景进行全景剖析
      </div>
    `;
  } else {
    // 根据 startEventId 到 endEventId 获取该场景对应的 NPC 列表
    const sceneNpcs = [];
    for (let i = s.startEventId + 1; i <= s.endEventId; i++) {
      const npcObj = state.eventObjects[i];
      if (npcObj && npcObj.type === 'npc') {
        sceneNpcs.push(npcObj);
      }
    }

    rightHtml = `
      <div data-scene-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
        <!-- 头部 -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">🗺️ Scene #${s.sceneId} (Map #${s.mapId}) 的多维场景档案</h2>
          </div>
        </div>

        <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
          <!-- 地图图元底签氛围区 -->
          <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
            <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🗺️ 场景专属 GOP 图元解码</span>
            <canvas id="canvas-scene-gop" width="120" height="120" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
            <div style="font-size: 7.5px; color: rgba(255,255,255,0.25); text-align: center; line-height: 1.3; margin-top: 4px;">
              大地图包 ID: gop.mkf #${s.mapId}<br>
              场景图元: GOP #0<br>
              自动平铺防滑绘制
            </div>
          </div>

          <!-- 场景具体参数以及包含的 NPC 物件 -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
            <!-- 地图与大场景元数据 -->
            <div>
              <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 场景事件与地图底牌
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">对应大地图 ID (mapId)</span>
                  <span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">0x${s.mapId.toString(16).toUpperCase()} (${s.mapId})</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">场景物体区间</span>
                  <span style="font-size: 9px; color: #fff; font-weight: bold;">${s.startEventId} ➔ ${s.endEventId}</span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">进入场景触发脚本</span>
                  <span style="font-size: 8.5px; font-weight: bold;">
                    ${s.enterScriptId > 0 ? `<span onclick="jumpToGameDataScript(${s.enterScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${s.enterScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                  </span>
                </div>
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size: 8px; color: rgba(255,255,255,0.3);">离开场景触发脚本</span>
                  <span style="font-size: 8.5px; font-weight: bold;">
                    ${s.exitScriptId > 0 ? `<span onclick="jumpToGameDataScript(${s.exitScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${s.exitScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                  </span>
                </div>
              </div>
            </div>

            <!-- 所属的 NPC 成员 -->
            <div>
              <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 当前场景内放置的 NPC 物体列表 (${sceneNpcs.length} 个)
              </div>
              <div style="border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.2); border-radius: 3px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 8px; text-align: left;">
                  <thead>
                    <tr style="background: rgba(255,215,0,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.35);">
                      <th style="padding: 4px 8px;">NPC ID</th>
                      <th style="padding: 4px 8px;">人物名称</th>
                      <th style="padding: 4px 8px;">坐标位置</th>
                      <th style="padding: 4px 8px;">自动脚本</th>
                      <th style="padding: 4px 8px;">触发脚本</th>
                      <th style="padding: 4px 8px;">交互跳转</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sceneNpcs.map(npc => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.015); transition: background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.02)'" onmouseleave="this.style.background='transparent'">
                        <td style="padding: 4px 8px; color:var(--glow-yellow); font-weight:bold;">#${npc.id}</td>
                        <td style="padding: 4px 8px; color:#fff;">${getRoleName(npc.roleId)}</td>
                        <td style="padding: 4px 8px; color:rgba(255,255,255,0.5);">(${npc.x}, ${npc.y})</td>
                        <td style="padding: 4px 8px;">
                          ${npc.autoScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.autoScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                        </td>
                        <td style="padding: 4px 8px;">
                          ${npc.trigScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.trigScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                        </td>
                        <td style="padding: 4px 8px;">
                          <button onclick="jumpToGameDataNpc(${npc.id})" class="btn-dbg" style="color:var(--glow-yellow); border-color:rgba(255,215,0,0.15); padding: 1px 4px; font-size: 7px; cursor:pointer;">定位 NPC</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = leftHtml + rightHtml;

  // 渲染场景瓦片图元底签
  if (s) {
    setTimeout(() => {
      try {
        const gopCanvas = loadGop(s.mapId, 0);
        if (gopCanvas) {
          drawPixelated(gopCanvas, 'canvas-scene-gop');
        }
      } catch (e) {
        console.error('绘制场景专属 GOP 失败:', e);
      }
    }, 30);
  }
}

export function onGameDataSceneSelect(sceneId) {
  selectedSceneId = sceneId;
  updateSceneSelection();
}

// 动态切换场景列表选中样式并仅刷新右侧详情
function updateSceneSelection() {
  const container = document.getElementById('gamedata-main-container');
  // 清除旧选中样式
  container.querySelectorAll('[data-scene-item]').forEach(el => {
    el.style.background = 'rgba(255,255,255,0.015)';
    el.style.borderColor = 'rgba(255,255,255,0.03)';
    const spans = el.querySelectorAll('span');
    if (spans[0]) spans[0].style.color = '#fff';
  });
  // 设置新选中样式
  const activeEl = container.querySelector(`[data-scene-item="${selectedSceneId}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.08)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    const spans = activeEl.querySelectorAll('span');
    if (spans[0]) spans[0].style.color = 'var(--glow-yellow)';
  }
  // 只重建右侧详情区
  const rightPanel = container.querySelector('[data-scene-right]');
  const s = state.scenes[selectedSceneId];
  if (rightPanel && s) {
    rightPanel.innerHTML = buildSceneRightHtml(s);
    setTimeout(() => {
      try {
        const gopCanvas = loadGop(s.mapId, 0);
        if (gopCanvas) drawPixelated(gopCanvas, 'canvas-scene-gop');
      } catch (e) { console.error('绘制场景专属 GOP 失败:', e); }
    }, 30);
  }
}

// 构建场景右侧详情 HTML
function buildSceneRightHtml(s) {
  const sceneNpcs = [];
  for (let i = s.startEventId + 1; i <= s.endEventId; i++) {
    const npcObj = state.eventObjects[i];
    if (npcObj && npcObj.type === 'npc') sceneNpcs.push(npcObj);
  }
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">🗺️ Scene #${s.sceneId} (Map #${s.mapId}) 的多维场景档案</h2>
      </div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🗺️ 场景专属 GOP 图元解码</span>
        <canvas id="canvas-scene-gop" width="120" height="120" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.25); text-align: center; line-height: 1.3; margin-top: 4px;">大地图包 ID: gop.mkf #${s.mapId}<br>场景图元: GOP #0<br>自动平铺防滑绘制</div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 场景事件与地图底牌</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">对应大地图 ID (mapId)</span><span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">0x${s.mapId.toString(16).toUpperCase()} (${s.mapId})</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">场景物体区间</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${s.startEventId} ➔ ${s.endEventId}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">进入场景触发脚本</span><span style="font-size: 8.5px; font-weight: bold;">${s.enterScriptId > 0 ? `<span onclick="jumpToGameDataScript(${s.enterScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${s.enterScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">离开场景触发脚本</span><span style="font-size: 8.5px; font-weight: bold;">${s.exitScriptId > 0 ? `<span onclick="jumpToGameDataScript(${s.exitScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${s.exitScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 当前场景内放置的 NPC 物体列表 (${sceneNpcs.length} 个)</div>
          <div style="border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.2); border-radius: 3px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 8px; text-align: left;">
              <thead>
                <tr style="background: rgba(255,215,0,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.35);">
                  <th style="padding: 4px 8px;">NPC ID</th>
                  <th style="padding: 4px 8px;">人物名称</th>
                  <th style="padding: 4px 8px;">坐标位置</th>
                  <th style="padding: 4px 8px;">自动脚本</th>
                  <th style="padding: 4px 8px;">触发脚本</th>
                  <th style="padding: 4px 8px;">交互跳转</th>
                </tr>
              </thead>
              <tbody>
                ${sceneNpcs.map(npc => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.015); transition: background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.02)'" onmouseleave="this.style.background='transparent'">
                    <td style="padding: 4px 8px; color:var(--glow-yellow); font-weight:bold;">#${npc.id}</td>
                    <td style="padding: 4px 8px; color:#fff;">${getRoleName(npc.roleId)}</td>
                    <td style="padding: 4px 8px; color:rgba(255,255,255,0.5);">(${npc.x}, ${npc.y})</td>
                    <td style="padding: 4px 8px;">
                      ${npc.autoScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.autoScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                    </td>
                    <td style="padding: 4px 8px;">
                      ${npc.trigScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.trigScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}
                    </td>
                    <td style="padding: 4px 8px;">
                      <button onclick="jumpToGameDataNpc(${npc.id})" class="btn-dbg" style="color:var(--glow-yellow); border-color:rgba(255,215,0,0.15); padding: 1px 4px; font-size: 7px; cursor:pointer;">定位 NPC</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}
