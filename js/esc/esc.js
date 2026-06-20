import { state } from '../engine/state.js';
import { loadFbp, loadPic, loadRgm, loadBall, loadWord } from '../resources/pal.js';
import { UI, PanelFactory } from '../ui/panel.js';
import { Script } from '../engine/script.js';
import { toggleScene, setRolePos } from '../engine/command.js';
import { update } from '../ui/draw.js';
import { loadArchive, saveArchive } from './archive.js';
import { fadeOut } from '../ui/fade.js';

export const ESC = {
  ShowStatus: false,
  showRole: false,
  showItem: false,
  showMenu: false,

  // 菜单管理栈，包含当前所有激活的菜单层级
  menuStack: [],

  pushMenu(name, panel, renderFn, onInputFn) {
    this.menuStack.push({ name, panel, render: renderFn, onInput: onInputFn });
    this.renderAll();
  },

  popMenu() {
    this.menuStack.pop();
    if (this.menuStack.length === 0) {
      this.clearMenus();
    } else {
      this.renderAll();
    }
  },

  clearMenus() {
    this.menuStack = [];
    this.hideMenuCanvas();
    state.currentMode = 'game'; // 恢复为游戏正常探索行走状态
  },

  renderAll() {
    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;
    
    // 步骤 1：清空当前启动/系统菜单画布以准备重绘
    startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

    // 步骤 2：自底向上依次渲染菜单栈中的全部活跃菜单界面
    for (let i = 0; i < this.menuStack.length; i++) {
      const menu = this.menuStack[i];
      if (menu.render) {
        menu.render();
      }
    }
  },

  // 接收分发自 input.js 的标准化键盘/触屏输入
  onInput(input) {
    // 步骤 1：若按下 ESC，根据设计直接关闭所有菜单退回游戏，不需要逐级 pop
    if (input === 'ESC') {
      this.clearMenus();
      return;
    }

    if (this.menuStack.length === 0) return;

    // 步骤 2：转发给栈顶活跃菜单的对应输入接口
    const activeMenu = this.menuStack[this.menuStack.length - 1];
    if (activeMenu.onInput) {
      activeMenu.onInput(input);
    } else if (activeMenu.panel) {
      activeMenu.panel.onInput(input);
    }
  },

  // 展现 ESC 菜单画布，不使用任何挂起 Promise
  showMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'block';
    }
  },

  // 隐藏 ESC 菜单画布
  hideMenuCanvas() {
    const startupCanvas = document.getElementById('startup');
    if (startupCanvas) {
      startupCanvas.style.display = 'none';
    }
  },

  onStatus() {
    const fbp = loadFbp(0);
    let currentPartyIndex = 0;

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx || !fbp) return;

      // 步骤 1：绘制状态背景图
      startupCtx.drawImage(fbp, 0, 0);

      // 步骤 2：校验并获取当前角色的基础及属性数据
      if (!state.party || state.party.length === 0) return;
      const role = state.party[currentPartyIndex];
      if (!role) return;

      const iPlayerRole = role.index;
      const roleStats = state.roles[iPlayerRole];
      if (!roleStats) return;

      // 步骤 3：绘制角色头像大图
      const avatarImg = loadRgm(roleStats.avatar);
      if (avatarImg) {
        startupCtx.drawImage(avatarImg, 110, 30);
      }

      // 步骤 4：绘制角色名字（使用黄色）
      UI.drawWord(roleStats.nameId, 110, 8, 0xFCDC84);

      // 步骤 5：绘制属性项标签文本（使用青绿色 0x8cbeae）
      const labelColor = 0x8cbeae;
      UI.drawWord(2, 6, 6, labelColor);    // 经验值
      UI.drawWord(48, 6, 32, labelColor);  // 修行
      UI.drawWord(49, 6, 54, labelColor);  // 体力
      UI.drawWord(50, 6, 76, labelColor);  // 真气
      UI.drawWord(51, 6, 98, labelColor);  // 武术
      UI.drawWord(52, 6, 118, labelColor); // 灵力
      UI.drawWord(53, 6, 138, labelColor); // 防御
      UI.drawWord(54, 6, 158, labelColor); // 身法
      UI.drawWord(55, 6, 178, labelColor); // 吉运

      // 步骤 6：绘制各属性的具体数值，且对齐至各原版预定边界位置
      const curExp = (state.exp && state.exp.rgPrimaryExp[iPlayerRole]) ? state.exp.rgPrimaryExp[iPlayerRole].wExp : 0;
      const nextExp = (state.levelUpExp && state.levelUpExp[roleStats.level]) ? state.levelUpExp[roleStats.level] : 0;
      UI.drawNum(curExp, 58 + 6 * 5, 6, 'yellow');
      UI.drawNum(nextExp, 58 + 6 * 5, 15, 'cyan');

      UI.drawNum(roleStats.level, 54 + 6 * 2, 35, 'yellow');

      UI.drawNum(roleStats.hp, 42 + 6 * 4, 56, 'yellow');
      UI.drawNum(roleStats.maxHp, 63 + 6 * 4, 61, 'blue');
      UI.drawSlash(65, 58);

      UI.drawNum(roleStats.mp, 42 + 6 * 4, 78, 'yellow');
      UI.drawNum(roleStats.maxMp, 63 + 6 * 4, 83, 'blue');
      UI.drawSlash(65, 80);

      UI.drawNum(roleStats.attackStrength, 42 + 6 * 4, 102, 'yellow');
      UI.drawNum(roleStats.magicStrength, 42 + 6 * 4, 122, 'yellow');
      UI.drawNum(roleStats.defense, 42 + 6 * 4, 142, 'yellow');
      UI.drawNum(roleStats.dexterity, 42 + 6 * 4, 162, 'yellow');
      UI.drawNum(roleStats.fleeRate, 42 + 6 * 4, 182, 'yellow');

      // 步骤 7：在装备栏位绘制对应装备图片及文字名称
      const equipImageBoxes = [
        { x: 189, y: -1 },
        { x: 247, y: 39 },
        { x: 251, y: 101 },
        { x: 201, y: 133 },
        { x: 141, y: 141 },
        { x: 81, y: 125 }
      ];
      const equipNames = [
        { x: 195, y: 38 },
        { x: 253, y: 78 },
        { x: 257, y: 140 },
        { x: 207, y: 172 },
        { x: 147, y: 180 },
        { x: 87, y: 164 }
      ];

      for (let part = 0; part < 6; part++) {
        const itemId = roleStats.equipments[part];
        if (itemId && itemId !== 0) {
          const itemConfig = state.items[itemId];
          if (itemConfig) {
            const bitmapId = itemConfig.roleId;
            const ballImg = loadBall(bitmapId);
            if (ballImg) {
              const box = equipImageBoxes[part];
              startupCtx.drawImage(ballImg, box.x + 1, box.y + 1);
            }
          }

          const nameBox = equipNames[part];
          const wordData = state.words[itemId];
          const wordLen = wordData ? wordData.length / 2 : 0;
          const widthPx = wordLen * 16;
          let offsetX = 0;
          if (nameBox.x + widthPx > 320) {
            offsetX = 320 - nameBox.x - widthPx;
          }
          UI.drawWord(itemId, nameBox.x + offsetX, nameBox.y, 0xD4D0C0);
        }
      }
    };

    const onInputFn = (input) => {
      // 步骤 8：状态界面按 E/S/空格/ESC 退回，按左右/上下方向键切换查看的队员
      if (input === 'e' || input === 's' || input === 'blank' || input === 'ESC') {
        ESC.popMenu();
      } else if (input === 'left' || input === 'up') {
        currentPartyIndex = (currentPartyIndex - 1 + state.party.length) % state.party.length;
        ESC.renderAll();
      } else if (input === 'right' || input === 'down') {
        currentPartyIndex = (currentPartyIndex + 1) % state.party.length;
        ESC.renderAll();
      }
    };

    ESC.showMenuCanvas();
    state.currentMode = 'esc';
    ESC.pushMenu('status', null, renderFn, onInputFn);
  },

  onStartup() {
    state.currentMode = 'startup';
    ESC.showMenuCanvas();

    const startupCtx = state.contexts.startup;
    if (!startupCtx) return;

    const fbpId = 0x3C;
    const fbp = loadFbp(fbpId);

    const startupPanel = PanelFactory.createList([7, 8])
      .canClose(false);
    startupPanel.x = 124;
    startupPanel.y = 96;

    const renderFn = () => {
      if (fbp) {
        startupCtx.drawImage(fbp, 0, 0);
      }
      startupPanel.draw();
    };

    startupPanel.onchange(() => {
      startNewStory();
    });

    ESC.pushMenu('startup', startupPanel, renderFn);

    document.addEventListener('touchend', function touchHandler(ev) {
      ev.preventDefault();
      startNewStory();
      document.removeEventListener('touchend', touchHandler);
    });
  },

  onMenu() {
    ESC.showMenuCanvas();
    state.currentMode = 'esc';
    ESC.menuStack = [];

    const mainPanel = PanelFactory.createList([3, 4, 5, 6]);
    mainPanel.x = 2;
    mainPanel.y = 36;

    const renderFn = () => {
      UI.drawLabel(0, 0, 5);
      UI.drawWord(0x15, 10, 8, 0x000000); // 绘制金钱文本标签
      UI.drawNum(state.money || 0, 85, 15); // 动态展示运行时金钱
      mainPanel.draw();
    };

    mainPanel.onchange((value) => {
      switch (value) {
        case 3:
          ESC.onStatus();
          break;
        case 4:
          ESC.onMagic();
          break;
        case 5:
          ESC.onItem();
          break;
        case 6:
          ESC.onSystem();
          break;
      }
    }).oncancel(() => {
      ESC.clearMenus();
    });

    ESC.pushMenu('main', mainPanel, renderFn);
  },

  onItem() {
    const itemPanel = PanelFactory.createList([22, 23]);
    itemPanel.x = 28;
    itemPanel.y = 60;

    const renderFn = () => {
      itemPanel.draw();
    };

    itemPanel.onchange((value) => {
      switch (value) {
        case 22:
          ESC.onEquipItem();
          break;
        case 23:
          ESC.onUseItem();
          break;
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('item', itemPanel, renderFn);
  },

  onUseItem() {
    ESC.openItemSelector('use');
  },

  onEquipItem() {
    // 步骤 1：若队伍有成员，则弹出选择角色面板
    if (!state.party || state.party.length === 0) return;

    const partyNames = state.party.map(role => state.roles[role.index].nameId);
    const rolePanel = PanelFactory.createList(partyNames);
    rolePanel.x = 28;
    rolePanel.y = 60;

    rolePanel.onchange((nameId) => {
      const chosenPartyRole = state.party.find(r => state.roles[r.index].nameId === nameId);
      if (chosenPartyRole) {
        const targetRole = state.roles[chosenPartyRole.index];
        // 步骤 2：选定队员后，带入成员对象并开启物品大面板（'equip' 模式）
        ESC.openItemSelector('equip', targetRole);
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('chooseEquipRole', rolePanel, () => rolePanel.draw());
  },

  openItemSelector(mode, targetRole = null) {
    // 步骤 1：去重统计行囊道具并保持其排序顺序，防止出现空物品面板
    const itemCounts = {};
    const uniqueItems = [];
    const ownItems = state.ownItems || [];
    for (const id of ownItems) {
      if (itemCounts[id] === undefined) {
        itemCounts[id] = 0;
        uniqueItems.push(id);
      }
      itemCounts[id]++;
    }

    let selectedIndex = 0;
    let scrollRow = 0;

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;

      // 步骤 2：绘制豪华的大面板红色背景，使用 10 号 Skin（320x136 像素）
      UI.drawArea(0, 0, 18, 7, 10);

      // 步骤 3：自上向下依次在 3 列网格中渲染可见行物品，并支持选中高亮与不同可用状态颜色
      const n = uniqueItems.length;
      for (let i = 0; i < n; i++) {
        const itemId = uniqueItems[i];
        const row = Math.floor(i / 3);
        const col = i % 3;

        // 只渲染位于当前可视范围内的行
        if (row < scrollRow || row >= scrollRow + 7) {
          continue;
        }

        const xText = 28 + col * 88;
        const yText = 16 + (row - scrollRow) * 18;
        const isSelected = (i === selectedIndex);

        // 校验该物品在当前选定模式/角色下的可用性
        let isUsable = false;
        if (mode === 'use') {
          isUsable = (state.items[itemId].flags & 1) !== 0;
        } else if (mode === 'equip' && targetRole) {
          isUsable = ((state.items[itemId].flags & 2) !== 0) && ((state.items[itemId].flags & (1 << (6 + targetRole.index))) !== 0);
        }

        // 金黄色为选中且可用，亮灰色为可用，暗红/褐红色为不可用状态
        let color = 0xD4D0C0;
        if (isUsable) {
          color = isSelected ? 0xFCDC84 : 0xD4D0C0;
        } else {
          color = isSelected ? 0xC0B050 : 0x803020;
        }

        UI.drawWord(itemId, xText, yText, color);

        // 如果是当前高亮选中项，在其右下角绘制白色三角形指示器 (PIC #70)
        if (isSelected) {
          const arrowImg = loadPic(70);
          const wordData = state.words[itemId];
          const wordLen = wordData ? wordData.length / 2 : 0;
          if (arrowImg) {
            startupCtx.drawImage(arrowImg, xText + wordLen * 16 - 2, yText + 5);
          }
        }

        // 若当前物品数量大于 1，则在其右侧对齐处渲染蓝绿色的数字数量
        const count = itemCounts[itemId];
        if (count > 1) {
          UI.drawNum(count, xText + 72, yText + 2, 'cyan');
        }
      }

      // 步骤 4：在最左下角绘制小图标底框 (PIC #71)，并在框中央绘制选中的物品球体大图标 (ball.mkf)
      if (n > 0 && selectedIndex < n) {
        const currItemId = uniqueItems[selectedIndex];
        const boxImg = loadPic(71);
        if (boxImg) {
          startupCtx.drawImage(boxImg, 0, 140);
        }

        const itemConfig = state.items[currItemId];
        if (itemConfig) {
          const ballImg = loadBall(itemConfig.roleId);
          if (ballImg) {
            startupCtx.drawImage(ballImg, 8, 147);
          }
        }

        // 步骤 5：解析当前选中项的 GBK 二进制描述流，识别 '*' 字符进行换行并用金黄色渲染
        const descBytes = state.desc[currItemId];
        if (descBytes) {
          let dx = 75;
          let dy = 144;
          let idx = 0;
          while (idx < descBytes.length) {
            const b = descBytes.getByte(idx);
            if (b === 42) {
              dx = 75;
              dy += 16;
              idx++;
            } else {
              if (idx + 1 < descBytes.length) {
                const charCode = descBytes.getShort(idx);
                const img = loadWord(charCode, 0xFCDC84);
                if (img) {
                  startupCtx.drawImage(img, dx, dy);
                }
                dx += 16;
                idx += 2;
              } else {
                idx++;
              }
            }
          }
        }
      }
    };

    const onInputFn = (input) => {
      const n = uniqueItems.length;
      if (input === 'ESC' || input === 'e') {
        ESC.popMenu();
        return;
      }

      if (n === 0) return;

      // 步骤 6：根据左右/上下键盘命令在 3 列网格网中换项，并自动滚动面板可视区
      if (input === 'left') {
        if (selectedIndex % 3 > 0) {
          selectedIndex--;
          updateScroll();
          ESC.renderAll();
        }
      } else if (input === 'right') {
        if (selectedIndex % 3 < 2 && selectedIndex + 1 < n) {
          selectedIndex++;
          updateScroll();
          ESC.renderAll();
        }
      } else if (input === 'up') {
        if (selectedIndex - 3 >= 0) {
          selectedIndex -= 3;
          updateScroll();
          ESC.renderAll();
        }
      } else if (input === 'down') {
        if (selectedIndex + 3 < n) {
          selectedIndex += 3;
          updateScroll();
          ESC.renderAll();
        }
      } else if (input === 'blank') {
        // 步骤 7：按下确定键 (空格)，根据使用模式或装备模式，调度触发对应的脚本线程
        const currItemId = uniqueItems[selectedIndex];
        let isUsable = false;
        if (mode === 'use') {
          isUsable = (state.items[currItemId].flags & 1) !== 0;
        } else if (mode === 'equip' && targetRole) {
          isUsable = ((state.items[currItemId].flags & 2) !== 0) && ((state.items[currItemId].flags & (1 << (6 + targetRole.index))) !== 0);
        }

        if (!isUsable) return;

        if (mode === 'use') {
          // 弹出选择队伍成员的小 Panel，决定对谁使用该物品
          const partyNames = state.party.map(role => state.roles[role.index].nameId);
          const rolePanel = PanelFactory.createList(partyNames);
          rolePanel.x = 220;
          rolePanel.y = 30;

          rolePanel.onchange((nameId) => {
            const chosenPartyRole = state.party.find(r => state.roles[r.index].nameId === nameId);
            if (chosenPartyRole) {
              const item = state.items[currItemId];
              item.index = chosenPartyRole.index;
              Script.startItemScript(item);
              ESC.clearMenus();
            }
          }).oncancel(() => {
            ESC.popMenu();
          });

          ESC.pushMenu('chooseUseRole', rolePanel, () => rolePanel.draw());
        } else if (mode === 'equip' && targetRole) {
          // 将物品的上下文指向选中的角色并激活装备执行脚本
          const item = state.items[currItemId];
          item.index = targetRole.index;
          Script.start(item.equScr, item, 'item');
          ESC.clearMenus();
        }
      }
    };

    const updateScroll = () => {
      const currRow = Math.floor(selectedIndex / 3);
      if (currRow < scrollRow) {
        scrollRow = currRow;
      } else if (currRow >= scrollRow + 7) {
        scrollRow = currRow - 7 + 1;
      }
    };

    ESC.pushMenu(mode + 'Item', null, renderFn, onInputFn);
  },

  onMagic() {},

  onSystem() {
    const systemPanel = PanelFactory.createList([11, 12, 13, 14, 15]);
    systemPanel.x = 28;
    systemPanel.y = 72;

    const renderFn = () => {
      systemPanel.draw();
    };

    systemPanel.onchange((value) => {
      switch (value) {
        case 11:
          ESC.onSaveGameMenu();
          break;
        case 12:
          ESC.onLoadGameMenu();
          break;
        case 13:
          console.log('系统设置 - 音乐选项选中');
          ESC.clearMenus();
          break;
        case 14:
          console.log('系统设置 - 音效选项选中');
          ESC.clearMenus();
          break;
        case 15:
          console.log('系统设置 - 结束游戏选项选中');
          ESC.clearMenus();
          break;
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('system', systemPanel, renderFn);
  },

  onSaveGameMenu() {
    const savePanel = PanelFactory.createList([43, 44, 45, 46, 47]);
    savePanel.x = 54;
    savePanel.y = 90;

    const renderFn = () => {
      savePanel.draw();
    };

    savePanel.onchange((value) => {
      let slotId = 1;
      if (value === 43 || value === 0x43) slotId = 1;
      else if (value === 44 || value === 0x44) slotId = 2;
      else if (value === 45 || value === 0x45) slotId = 3;
      else if (value === 46 || value === 0x46) slotId = 4;
      else if (value === 47 || value === 0x47) slotId = 5;

      saveArchive(slotId);
      ESC.clearMenus();
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('saveGame', savePanel, renderFn);
  },

  onLoadGameMenu() {
    const loadPanel = PanelFactory.createList([43, 44, 45, 46, 47]);
    loadPanel.x = 54;
    loadPanel.y = 90;

    const renderFn = () => {
      loadPanel.draw();
    };

    loadPanel.onchange((value) => {
      let slotId = 1;
      if (value === 43 || value === 0x43) slotId = 1;
      else if (value === 44 || value === 0x44) slotId = 2;
      else if (value === 45 || value === 0x45) slotId = 3;
      else if (value === 46 || value === 0x46) slotId = 4;
      else if (value === 47 || value === 0x47) slotId = 5;

      loadArchive(slotId, () => {
        setRolePos(state.mx, state.my, state.mhalf);
        update();
        ESC.clearMenus();
      });
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('loadGame', loadPanel, renderFn);
  }
};

async function startNewStory() {
  ESC.menuStack = []; // 清空菜单栈，防止在淡出过渡期间重复按键触发
  
  // 1. 淡出屏幕
  await fadeOut();

  // 2. 隐藏startup层
  const el = document.getElementById('startup');
  el.style.display = 'none';

  // 3. 启动新的故事
  await newStory();
}

function newStory() {
  state.currentMode = 'game'; // 激活常规游戏行走模式
  toggleScene(1);
  state.isPaused = false;
}
