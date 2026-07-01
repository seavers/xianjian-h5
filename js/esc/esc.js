import { state } from '../engine/state.js';
import { loadFbp, loadPic, loadRgm, loadBall, loadWord } from '../resources/pal.js';
import { UI, PanelFactory } from '../ui/panel.js';
import { Script } from '../engine/script.js';
import { toggleScene, setRolePos } from '../engine/command.js';
import { update } from '../ui/draw.js';
import { loadArchive, saveArchive } from './archive.js';
import { fadeOut } from '../ui/fade.js';
import {
  COLOR_YELLOW,
  COLOR_GRAY,
  COLOR_DARK_GRAY,
  COLOR_RED_BROWN,
  COLOR_MUTED_RED,
  COLOR_LIGHT_RED,
  COLOR_DARK_RED,
  COLOR_CYAN
} from '../ui/colors.js';

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
    state.uiMode = 'operate'; // 恢复为游戏正常探索行走状态
    if (state.currentMode === 'battle' && window.Battle && typeof window.Battle.draw === 'function') {
      window.Battle.draw();
    }
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
      // 特殊情况：如果当前位于装备比对界面，则仅 popMenu 回退至装备列表，而不是直接关闭所有菜单
      if (this.menuStack.length > 0 && this.menuStack[this.menuStack.length - 1].name === 'equipComparison') {
        this.popMenu();
        return;
      }
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
    state.uiMode = 'esc';
    ESC.pushMenu('status', null, renderFn, onInputFn);
  },

  onStartup() {
    state.currentMode = 'startup';
    state.uiMode = 'operate';
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
    state.uiMode = 'esc';
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
    // 步骤 1：直接开启物品大面板（'equip' 模式），先选择装备
    ESC.openItemSelector('equip');
  },

  openItemSelector(mode, targetRole = null) {
    let selectedIndex = 0;
    let scrollRow = 0;

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;

      // 步骤 1：动态统计行囊道具种类和数量，支持在穿脱装备后的数量变化同步刷新
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

      // 步骤 2：对选择索引进行双向夹逼限幅保护，防止数量缩水导致越界崩溃
      if (selectedIndex >= uniqueItems.length) {
        selectedIndex = Math.max(0, uniqueItems.length - 1);
      }
      if (selectedIndex < 0) {
        selectedIndex = 0;
      }

      // 步骤 3：绘制大面板红色背景，使用 10 号 Skin（320x136 像素）
      UI.drawScrollBox(0, 0, 18, 7);

      // 步骤 4：在 3 列网格网中绘制当前可视页面的物品
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

        // 校验该物品在当前选定模式下的可用性并防范配置未定义
        const item = state.items[itemId];
        if (!item) continue;

        let isUsable = false;
        if (mode === 'use') {
          isUsable = (item.flags & 1) !== 0;
        } else if (mode === 'equip') {
          isUsable = (item.flags & 2) !== 0;
        }

        // 步骤 5：确定绘制颜色，从调色板常量中进行选择
        let color = COLOR_GRAY;
        if (isUsable) {
          color = isSelected ? COLOR_YELLOW : COLOR_GRAY;
        } else {
          color = isSelected ? COLOR_LIGHT_RED : COLOR_DARK_RED;
        }

        UI.drawWord(itemId, xText, yText, color);

        // 若当前物品数量大于 1，则在其右侧对齐处渲染蓝绿色的数字数量，整体下移 6 像素以平齐
        const count = itemCounts[itemId];
        if (count > 1) {
          UI.drawNum(count, xText + 72, yText + 8, 'cyan');
        }

        // 步骤 6：如果是当前选中的高亮项，无论是否有数量、几个字，指示器 (PIC #70) 均固定绘制在第二个字靠右 (xText + 32)
        if (isSelected) {
          const arrowImg = loadPic(70);
          if (arrowImg) {
            startupCtx.drawImage(arrowImg, xText + 24, yText + 11);
          }
        }
      }

      // 步骤 7：在最左下角绘制小图标底框，并在框中央绘制选中的物品球体大图标
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

        // 步骤 8：解析并绘制 GBK/Big5 二进制描述流，完美兼容包含在 desc.dat 中的 ASCII 属性变更字串
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
            } else if (b === 32) {
              dx += 8;
              idx++;
            } else if (b < 128) {
              const img = loadWord(b, COLOR_YELLOW);
              if (img) {
                startupCtx.drawImage(img, dx, dy + 1);
              }
              dx += 8;
              idx++;
            } else {
              if (idx + 1 < descBytes.length) {
                const charCode = descBytes.getShort(idx);
                const img = loadWord(charCode, COLOR_YELLOW);
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

    const onInputFn = async (input) => {
      // 步骤 9：按键时动态收集最新的背包道具信息以保证逻辑一致
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

      const n = uniqueItems.length;
      if (input === 'ESC' || input === 'e') {
        ESC.popMenu();
        return;
      }

      if (n === 0) return;

      // 再次夹逼以保证安全性
      if (selectedIndex >= n) {
        selectedIndex = n - 1;
      }
      if (selectedIndex < 0) {
        selectedIndex = 0;
      }

      // 步骤 10：根据左右/上下方向键更改高亮索引并自动滚动可是区域
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
        // 步骤 11：按下确定键 (空格)，根据模式执行使用或者跳转至装备对比页面
        const currItemId = uniqueItems[selectedIndex];
        const item = state.items[currItemId];
        if (!item) return;

        let isUsable = false;
        if (mode === 'use') {
          isUsable = (item.flags & 1) !== 0;
        } else if (mode === 'equip') {
          isUsable = (item.flags & 2) !== 0;
        }

        if (!isUsable) return;

        if (mode === 'use') {
          const itemToUse = state.items[currItemId];
          const isTargetAll = (itemToUse.flags & 16) !== 0;
          if (isTargetAll) {
            state.scriptSuccess = true;

            // 这里不能使用 runTriggerScript，因为需要先关闭物品列表对话框
            // const nextUseScr = await Script.runTriggerScript(itemToUse.useScr, state.party[0], 'item');
            // if (state.scriptSuccess !== false) {
            //   if (nextUseScr !== undefined) itemToUse.useScr = nextUseScr;
            //   const idx = state.ownItems.indexOf(currItemId);
            //   if (idx > -1) {
            //     state.ownItems.splice(idx, 1);
            //   }
            // }

            Script.startItemScript(itemToUse);
            ESC.clearMenus();
            ESC.renderAll();
          } else {
            ESC.openItemUseMenu(currItemId);
          }
        } else if (mode === 'equip') {
          // 选中可装备的道具时，按空格跳转到比对装备前后属性对备面板
          ESC.openEquipComparison(currItemId);
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

  openEquipComparison(itemId) {
    // 对队伍中所有角色的初始属性根据其已有装备进行一次性校正，防止初始基础值遗漏装备属性导致一直为 0
    if (state.party) {
      for (const pRole of state.party) {
        const role = state.roles[pRole.index];
        if (role && role.equipments && !role._equipCorrected) {
          role._equipCorrected = true; // 标记只在打开本页面时校正一次
          for (let part = 0; part < 6; part++) {
            const eqId = role.equipments[part];
            if (eqId && eqId !== 0) {
              const eqAttrs = getEquipItemAttributes(eqId);
              for (const key in eqAttrs) {
                if (typeof role[key] !== 'number' || isNaN(role[key])) {
                  role[key] = 0;
                }
                role[key] += eqAttrs[key];
              }
            }
          }
        }
      }
    }

    let roleIndexInParty = 0;

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;

      // 步骤 1：检验队伍成员的合法性，防止快速按键期间因数据同步引起空指针访问
      if (!state.party || state.party.length === 0) return;
      if (roleIndexInParty >= state.party.length) {
        roleIndexInParty = 0;
      }
      const partyRole = state.party[roleIndexInParty];
      if (!partyRole) return;
      const curRole = state.roles[partyRole.index];
      if (!curRole) return;

      // 步骤 2：绘制全屏木纹装备对比背景图 fbp(1)
      const fbp = loadFbp(1);
      if (fbp) {
        startupCtx.drawImage(fbp, 0, 0);
      }

      // 步骤 3：绘制左上角的小框底图 (PIC #71) 及对应的球形图标 (ball.mkf)
      const boxImg = loadPic(71);
      if (boxImg) {
        startupCtx.drawImage(boxImg, 8, 8);
      }
      const item = state.items[itemId];
      if (item) {
        const ballImg = loadBall(item.roleId);
        if (ballImg) {
          startupCtx.drawImage(ballImg, 16, 15);
        }
      }

      // 步骤 4：绘制物品名字及右下角的绿色数量字样 (右移1像素，X坐标设为64)
      if (item) {
        UI.drawWord(itemId, 5, 70, COLOR_GRAY);
        const ownItems = state.ownItems || [];
        const count = ownItems.filter(id => id === itemId).length;
        if (count > 0) {
          UI.drawNum(count, 64, 57, 'cyan');
        }
      }

      // 步骤 5：在左下角使用大红木纹卷轴框 (style=1) 绘制使用人切换列表，选中可装备为明黄色，未选中可装备为深黑色，选中不可装备为粉红，未选中不可装备为红褐色
      UI.drawModalBox(2, 95, 3, state.party.length);
      for (let i = 0; i < state.party.length; i++) {
        const pRole = state.party[i];
        if (!pRole || !state.roles[pRole.index]) continue;
        const nameId = state.roles[pRole.index].nameId;
        const isSelected = (i === roleIndexInParty);
        const isEquipable = ((state.items[itemId].flags & 2) !== 0) && ((state.items[itemId].flags & (1 << (6 + pRole.index))) !== 0);

        let color = COLOR_DARK_GRAY;
        if (isEquipable) {
          color = isSelected ? COLOR_YELLOW : COLOR_DARK_GRAY;
        } else {
          color = isSelected ? COLOR_LIGHT_RED : COLOR_RED_BROWN;
        }
        UI.drawWord(nameId, 15, 108 + i * 18, color);
      }

      // 步骤 6：绘制 6 个装备部位的当前穿戴装备名字 (灰色 COLOR_GRAY)，Y 轴间距为原版的 22 像素偏移，X 轴左移对齐
      for (let part = 0; part < 6; part++) {
        const eqItemId = curRole.equipments[part];
        if (eqItemId && eqItemId !== 0) {
          UI.drawWord(eqItemId, 130, 11 + part * 22, COLOR_GRAY);
        }
      }

      // 步骤 7：绘制武术、灵力、防御、身法、吉运的当前总属性数值 (明黄色 yellow)，Y 轴间距为原版的 22 像素偏移，X 轴右边缘对齐为 290
      UI.drawNum(curRole.attackStrength || 0, 290, 14, 'yellow');
      UI.drawNum(curRole.magicStrength || 0, 290, 36, 'yellow');
      UI.drawNum(curRole.defense || 0, 290, 58, 'yellow');
      UI.drawNum(curRole.dexterity || 0, 290, 80, 'yellow');
      UI.drawNum(curRole.fleeRate || 0, 290, 102, 'yellow');
    };

    const onInputFn = (input) => {
      // 步骤 8：进行按键时的防御式空指针与越界校验
      if (!state.party || state.party.length === 0) return;
      const partyLen = state.party.length;
      if (input === 'ESC' || input === 'e') {
        ESC.popMenu();
        return;
      }

      if (partyLen === 0) return;
      if (roleIndexInParty >= partyLen) {
        roleIndexInParty = 0;
      }
      const partyRole = state.party[roleIndexInParty];
      if (!partyRole) return;
      const curRole = state.roles[partyRole.index];
      if (!curRole) return;

      // 步骤 9：按上下方向键切换不同的对比队员
      if (input === 'up') {
        roleIndexInParty = (roleIndexInParty - 1 + partyLen) % partyLen;
        ESC.renderAll();
      } else if (input === 'down') {
        roleIndexInParty = (roleIndexInParty + 1) % partyLen;
        ESC.renderAll();
      } else if (input === 'blank') {
        // 步骤 10：空格键触发穿戴/卸下对比装备，增减对应五维属性
        const curItem = state.items[itemId];
        if (!curItem) return;

        const isEquipable = ((curItem.flags & 2) !== 0) && ((curItem.flags & (1 << (6 + curRole.index))) !== 0);
        if (!isEquipable) return;

        const part = getItemEquipPart(itemId);
        if (part === -1) return;

        if (curRole.equipments[part] === itemId) {
          // 脱下逻辑 (属性扣减，装备归还背包，装备槽清空)
          const attrs = getEquipItemAttributes(itemId);
          for (const key in attrs) {
            if (typeof curRole[key] !== 'number' || isNaN(curRole[key])) {
              curRole[key] = 0;
            }
            curRole[key] -= attrs[key];
          }
          state.ownItems.push(itemId);
          curRole.equipments[part] = 0;
        } else {
          // 穿戴逻辑 (卸下旧装备，扣除旧属性；穿上新装备，从背包划去，增加新属性)
          const oldItemId = curRole.equipments[part];
          if (oldItemId && oldItemId !== 0) {
            const oldAttrs = getEquipItemAttributes(oldItemId);
            for (const key in oldAttrs) {
              if (typeof curRole[key] !== 'number' || isNaN(curRole[key])) {
                curRole[key] = 0;
              }
              oldAttrs[key] = Math.floor(oldAttrs[key]);
              curRole[key] -= oldAttrs[key];
            }
            state.ownItems.push(oldItemId);
          }

          curRole.equipments[part] = itemId;
          const idx = state.ownItems.indexOf(itemId);
          if (idx > -1) {
            state.ownItems.splice(idx, 1);
          }

          const newAttrs = getEquipItemAttributes(itemId);
          for (const key in newAttrs) {
            if (typeof curRole[key] !== 'number' || isNaN(curRole[key])) {
              curRole[key] = 0;
            }
            curRole[key] += newAttrs[key];
          }

          // 步骤 11：替换装备时，将当前手里拿着待比对的装备 itemId 更新为替换下来的旧装备
          if (oldItemId && oldItemId !== 0) {
            itemId = oldItemId;
          }
        }
        ESC.renderAll();
      }
    };

    ESC.pushMenu('equipComparison', null, renderFn, onInputFn);
  },

  onMagic() {
    // 步骤 1：若队伍只有 1 人，直接跳过选人阶段进入该角色的仙术列表
    if (state.party.length === 1) {
      ESC.openMagicSelector(0);
      return;
    }

    // 步骤 2：若有多个队员，弹出一个使用人名字选择列表面板
    const casterPanel = PanelFactory.createList(state.party.map(p => state.roles[p.index].nameId));
    casterPanel.x = 28;
    casterPanel.y = 60;
    casterPanel.width = 3;

    const renderFn = () => {
      casterPanel.draw();
    };

    casterPanel.onchange((value) => {
      const idx = state.party.findIndex(p => state.roles[p.index].nameId === value);
      if (idx !== -1) {
        ESC.openMagicSelector(idx);
      }
    }).oncancel(() => {
      ESC.popMenu();
    });

    ESC.pushMenu('magicCaster', casterPanel, renderFn);
  },

  openMagicSelector(casterPartyIndex) {
    let selectedMagicIndex = 0;
    let scrollRow = 0;
    let uiState = 'select_magic'; // 两个子状态: 'select_magic' 或 'select_target'
    let targetPartyIndex = casterPartyIndex; // 目标人物默认为施法者自己

    // 辅助函数：将数字自左向右绘制到 startupCtx 上，以与战斗中 HP/MP 格式对齐
    const drawNumberToStartupCtx = (num, x, y, type = 'cyan') => {
      let baseId = 57; // 默认青色
      if (type === 'hp' || type === 'yellow') {
        baseId = 20;
      } else if (type === 'blue') {
        baseId = 30;
      }

      const numStr = num.toString();
      const digitW = 6;
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return x;

      let currX = x;
      for (let i = 0; i < numStr.length; i++) {
        const digit = parseInt(numStr.charAt(i));
        const digitImg = loadPic(baseId + digit);
        if (digitImg) {
          startupCtx.drawImage(digitImg, currX, y);
        }
        currX += digitW;
      }
      return currX;
    };

    // 辅助函数：为 Pic 图片进行特定颜色替换后，绘制到 startupCtx 上，用于灰色目标箭头
    const drawColorPic = (picId, x, y, color, ctx) => {
      const pic = loadPic(picId);
      if (!pic) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = pic.width;
      tempCanvas.height = pic.height;
      const tempCtx = tempCanvas.getContext('2d');

      // 将 RLE 图片先绘制到临时画布中，随后填充指定的调色板颜色
      tempCtx.drawImage(pic, 0, 0);
      tempCtx.globalCompositeOperation = 'source-in';

      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      tempCtx.fillStyle = `rgb(${r},${g},${b})`;
      tempCtx.fillRect(0, 0, pic.width, pic.height);

      ctx.drawImage(tempCanvas, x, y);
    };

    // 步骤 3：定义仙术描述文本解析与绘制的本地辅助函数
    const drawDesc = (magicId, dx, dy, color) => {
      const descBytes = state.desc[magicId];
      if (!descBytes) return;
      let startX = dx;
      let idx = 0;
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;
      while (idx < descBytes.length) {
        const b = descBytes.getByte(idx);
        if (b === 42) { // 字符 '*'
          dx = startX;
          dy += 16;
          idx++;
        } else if (b === 32) { // 空格
          dx += 8;
          idx++;
        } else if (b < 128) {
          const img = loadWord(b, color);
          if (img) {
            startupCtx.drawImage(img, dx, dy + 1);
          }
          dx += 8;
          idx++;
        } else {
          if (idx + 1 < descBytes.length) {
            const charCode = descBytes.getShort(idx);
            const img = loadWord(charCode, color);
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
    };

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;

      // 校验并提取当前施法者数据
      if (!state.party || casterPartyIndex >= state.party.length) return;
      const casterPartyRole = state.party[casterPartyIndex];
      const casterRole = state.roles[casterPartyRole.index];
      if (!casterRole) return;

      // 步骤 4：构建角色学会的全部仙术信息列表
      const magicsList = (casterRole.magics || []).map(magicId => {
        const item = state.items[magicId];
        if (!item) return null;
        const magicNumber = item.roleId;
        const magic = state.magics[magicNumber];
        if (!magic) return null;
        // 是否可用：非战斗可用 (gold & 1) 且 MP 足够
        const isUsable = ((item.gold & 1) !== 0) && (casterRole.mp >= magic.wCostMP);
        return { magicId, item, magic, isUsable };
      }).filter(m => m !== null);

      if (selectedMagicIndex >= magicsList.length) {
        selectedMagicIndex = Math.max(0, magicsList.length - 1);
      }

      // 步骤 5：绘制锦缎大控制框（与战斗一模一样，大小：宽 17，高 5，坐标 10, 40）
      UI.drawScrollBox(10, 40, 17, 5, startupCtx);

      // 步骤 6：利用 3 列滚动网格绘制当前的仙术项（最大显示 3 行，与战斗一致）
      const colW = 88;
      const rowH = 18;
      const startY = 48;
      const maxRows = 3;

      for (let i = 0; i < magicsList.length; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;

        if (row < scrollRow || row >= scrollRow + maxRows) continue;

        const xText = 34 + col * colW;
        const yText = startY + (row - scrollRow) * rowH;
        const isSelected = (i === selectedMagicIndex);
        const itemInfo = magicsList[i];

        // 确定字色：如果不可用为深灰，可用且选中为黄色高亮，否则经典灰色
        let color = COLOR_GRAY;
        if (itemInfo.isUsable) {
          color = isSelected ? COLOR_YELLOW : COLOR_GRAY;
        } else {
          color = 0x555555;
        }

        UI.drawWord(itemInfo.magicId, xText, yText, color);

        // 选择法术状态：被选中项下方绘制 Pic #70 白色向上指示器
        if (isSelected && uiState === 'select_magic') {
          const arrowImg = loadPic(70);
          if (arrowImg) {
            startupCtx.drawImage(arrowImg, xText + 24, yText + 11);
          }
        }

        // 选择目标状态：被选中项上方绘制 Y 轴镜像反转的 Pic #69 黄色向下指示器
        if (isSelected && uiState === 'select_target') {
          UI.drawPicFlippedY(69, xText + 24, yText - 4, startupCtx);
        }
      }

      // 步骤 7：绘制高亮选中法术的消耗 MP 以及右上角的描述内容
      if (magicsList.length > 0 && selectedMagicIndex < magicsList.length) {
        const curMagic = magicsList[selectedMagicIndex];

        // 绘制左上角使用MP/当前主角MP框 (x: 0, y: 0, w: 6)，与战斗中一模一样
        UI.drawSingleLineBox(0, 0, 6, startupCtx);

        // 用调色板数字自左往右绘制
        let startX = 18;
        startX = drawNumberToStartupCtx(curMagic.magic.wCostMP, startX, 15, 'cyan');
        const slashImg = loadPic(40);
        if (slashImg) {
          startupCtx.drawImage(slashImg, startX + 1, 15);
          startX += slashImg.width + 3;
        } else {
          startX += 6;
        }
        drawNumberToStartupCtx(casterRole.mp, startX, 15, 'cyan');

        // 绘制右上角选中的法术文字描述，位置设为与战斗中的描述位置一模一样的 (120, 2)
        drawDesc(curMagic.magicId, 120, 2, COLOR_YELLOW);
      }

      // 步骤 8：绘制最底部的队伍成员头像与数值状态
      const totalParty = state.party.length;
      const bxStart = Math.floor((320 - (77 * (totalParty - 1) + 74)) / 2);

      for (let i = 0; i < totalParty; i++) {
        const pRole = state.party[i];
        const roleStats = state.roles[pRole.index];
        if (!roleStats) continue;

        const bx = bxStart + 77 * i;
        const by = 165;

        // 绘制状态小木框背景
        const borderImg = loadPic(72);
        if (borderImg) {
          startupCtx.drawImage(borderImg, bx, by);
        }

        // 绘制头像
        const avatarImg = loadPic(49 + pRole.index);
        if (avatarImg) {
          if (roleStats.hp <= 0) {
            startupCtx.save();
            startupCtx.filter = 'grayscale(100%)';
            startupCtx.drawImage(avatarImg, bx - 3, by);
            startupCtx.restore();
          } else {
            startupCtx.drawImage(avatarImg, bx - 3, by);
          }
        }

        // 绘制 HP 数值属性 (自左向右绘制)
        const hp = Math.max(0, roleStats.hp);
        let hpX = bx + 50;
        hpX = drawNumberToStartupCtx(hp, hpX, by + 6, 'hp');
        const slashImg1 = loadPic(40);
        if (slashImg1) {
          startupCtx.drawImage(slashImg1, hpX + 1, by + 7);
          hpX += slashImg1.width + 3;
        } else {
          hpX += 6;
        }
        drawNumberToStartupCtx(roleStats.maxHp, hpX, by + 10, 'blue');

        // 绘制 MP 数值属性 (自左向右绘制)
        let mpX = bx + 50;
        mpX = drawNumberToStartupCtx(roleStats.mp, mpX, by + 19, 'cyan');
        const slashImg2 = loadPic(40);
        if (slashImg2) {
          startupCtx.drawImage(slashImg2, mpX + 1, by + 20);
          mpX += slashImg2.width + 3;
        } else {
          mpX += 6;
        }
        drawNumberToStartupCtx(roleStats.maxMp, mpX, by + 23, 'blue');

        // 选择目标状态：被选中的目标上方绘制灰色向下指示器，对齐在头像正上方 (bx + 30)
        if (uiState === 'select_target' && i === targetPartyIndex) {
          drawColorPic(67, bx + 30, 158, COLOR_GRAY, startupCtx);
        }
      }
    };

    const onInputFn = async (input) => {
      if (!state.party || casterPartyIndex >= state.party.length) return;
      const casterPartyRole = state.party[casterPartyIndex];
      const casterRole = state.roles[casterPartyRole.index];
      if (!casterRole) return;

      const magicsList = (casterRole.magics || []).map(magicId => {
        const item = state.items[magicId];
        if (!item) return null;
        const magicNumber = item.roleId;
        const magic = state.magics[magicNumber];
        if (!magic) return null;
        const isUsable = ((item.gold & 1) !== 0) && (casterRole.mp >= magic.wCostMP);
        return { magicId, item, magic, isUsable };
      }).filter(m => m !== null);

      if (selectedMagicIndex >= magicsList.length) {
        selectedMagicIndex = Math.max(0, magicsList.length - 1);
      }

      if (uiState === 'select_magic') {
        const n = magicsList.length;
        if (input === 'ESC' || input === 'e') {
          ESC.popMenu();
          return;
        }

        if (n === 0) return;

        if (input === 'left') {
          if (selectedMagicIndex % 3 > 0) {
            selectedMagicIndex--;
            updateScroll();
            ESC.renderAll();
          }
        } else if (input === 'right') {
          if (selectedMagicIndex % 3 < 2 && selectedMagicIndex + 1 < n) {
            selectedMagicIndex++;
            updateScroll();
            ESC.renderAll();
          }
        } else if (input === 'up') {
          if (selectedMagicIndex - 3 >= 0) {
            selectedMagicIndex -= 3;
            updateScroll();
            ESC.renderAll();
          }
        } else if (input === 'down') {
          if (selectedMagicIndex + 3 < n) {
            selectedMagicIndex += 3;
            updateScroll();
            ESC.renderAll();
          }
        } else if (input === 'blank') {
          const curMagic = magicsList[selectedMagicIndex];
          if (!curMagic || !curMagic.isUsable) return;

          // 步骤 9：判定全体还是单体仙术
          const isTargetAll = (curMagic.item.gold & 16) !== 0;
          if (isTargetAll) {
            await castMagic(curMagic, null);
            ESC.renderAll();
          } else {
            uiState = 'select_target';
            targetPartyIndex = casterPartyIndex;
            ESC.renderAll();
          }
        }
      } else if (uiState === 'select_target') {
        if (input === 'ESC' || input === 'e') {
          uiState = 'select_magic';
          ESC.renderAll();
          return;
        }

        const partyLen = state.party.length;
        if (input === 'left' || input === 'up') {
          targetPartyIndex = (targetPartyIndex - 1 + partyLen) % partyLen;
          ESC.renderAll();
        } else if (input === 'right' || input === 'down') {
          targetPartyIndex = (targetPartyIndex + 1) % partyLen;
          ESC.renderAll();
        } else if (input === 'blank') {
          const curMagic = magicsList[selectedMagicIndex];
          if (!curMagic) return;

          const targetRole = state.party[targetPartyIndex];
          await castMagic(curMagic, targetRole);

          // 步骤 10：施法完毕后根据余下 MP 决定是否保留在施法状态
          const latestCasterRole = state.roles[casterPartyRole.index];
          if (latestCasterRole.mp < curMagic.magic.wCostMP) {
            uiState = 'select_magic';
          }
          ESC.renderAll();
        }
      }
    };

    const updateScroll = () => {
      const currRow = Math.floor(selectedMagicIndex / 3);
      if (currRow < scrollRow) {
        scrollRow = currRow;
      } else if (currRow >= scrollRow + 3) {
        scrollRow = currRow - 3 + 1;
      }
    };

    const castMagic = async (magicInfo, targetRole) => {
      state.scriptSuccess = true;

      const item = magicInfo.item;
      let nextEquScr = item.equScr;
      if (item.equScr && item.equScr !== 0) {
        nextEquScr = await Script.runTriggerScript(item.equScr, targetRole, 'item');
      }

      let nextUseScr = item.useScr;
      if (state.scriptSuccess !== false) {
        if (item.useScr && item.useScr !== 0) {
          nextUseScr = await Script.runTriggerScript(item.useScr, targetRole, 'item');
        }
      }

      if (state.scriptSuccess !== false) {
        const casterPartyRole = state.party[casterPartyIndex];
        const casterRole = state.roles[casterPartyRole.index];
        casterRole.mp -= magicInfo.magic.wCostMP;
        if (casterRole.mp < 0) casterRole.mp = 0;

        if (nextEquScr !== undefined) item.equScr = nextEquScr;
        if (nextUseScr !== undefined) item.useScr = nextUseScr;
        console.log(`[castMagic] 成功施法，消耗 MP: ${magicInfo.magic.wCostMP}`);
      } else {
        console.warn(`[castMagic] 施放仙术被脚本标记为失败`);
      }
    };

    ESC.pushMenu('magicSelector', null, renderFn, onInputFn);
  },

  openItemUseMenu(itemId) {
    let selectedPlayerIndex = 0;

    const renderFn = () => {
      const startupCtx = state.contexts.startup;
      if (!startupCtx) return;

      // 步骤 1：绘制右半部分的大红卷轴边框 (X=110, Y=2, 宽度11, 高度9)
      UI.drawModalBox(110, 2, 11, 8);

      // 步骤 2：绘制当前选定角色的八维属性
      if (!state.party || selectedPlayerIndex >= state.party.length) return;
      const pRole = state.party[selectedPlayerIndex];
      const roleStats = state.roles[pRole.index];
      if (!roleStats) return;

      // 绘制八个属性项的标签名 (青色 0x8cbeae)
      const labelColor = 0x8cbeae;
      UI.drawWord(48, 200, 16, labelColor);  // 修行
      UI.drawWord(49, 200, 34, labelColor);  // 体力
      UI.drawWord(50, 200, 52, labelColor);  // 真气
      UI.drawWord(51, 200, 70, labelColor);  // 武术
      UI.drawWord(52, 200, 88, labelColor);  // 灵力
      UI.drawWord(53, 200, 106, labelColor); // 防御
      UI.drawWord(54, 200, 124, labelColor); // 身法
      UI.drawWord(55, 200, 142, labelColor); // 吉运

      // 绘制具体数值
      UI.drawNum(roleStats.level, 280, 16, 'yellow');

      UI.drawSlash(258, 35);
      UI.drawNum(roleStats.hp, 258, 34, 'yellow');
      UI.drawNum(roleStats.maxHp, 280, 37, 'blue');

      UI.drawSlash(258, 53);
      UI.drawNum(roleStats.mp, 258, 52, 'yellow');
      UI.drawNum(roleStats.maxMp, 280, 55, 'blue');

      UI.drawNum(roleStats.attackStrength || 0, 280, 70, 'yellow');
      UI.drawNum(roleStats.magicStrength || 0, 280, 88, 'yellow');
      UI.drawNum(roleStats.defense || 0, 280, 106, 'yellow');
      UI.drawNum(roleStats.dexterity || 0, 280, 124, 'yellow');
      UI.drawNum(roleStats.fleeRate || 0, 280, 142, 'yellow');

      // 步骤 3：绘制左上角的人名列表，选中为明黄色，未选中为灰白色
      for (let i = 0; i < state.party.length; i++) {
        const p = state.party[i];
        const isSelected = (i === selectedPlayerIndex);
        const color = isSelected ? COLOR_YELLOW : COLOR_GRAY;
        UI.drawWord(state.roles[p.index].nameId, 125, 16 + 20 * i, color);
      }

      // 步骤 4：绘制左下角的道具小纸卷轴、大球图及数量名称
      const boxImg = loadPic(71);
      if (boxImg) {
        startupCtx.drawImage(boxImg, 120, 80);
      }

      const item = state.items[itemId];
      if (item) {
        const ballImg = loadBall(item.roleId);
        if (ballImg) {
          startupCtx.drawImage(ballImg, 128, 87);
        }

        UI.drawWord(itemId, 116, 143, COLOR_GRAY);

        // 统计该道具在背包里的剩余数量，并绘制在小图标的右下边
        const count = (state.ownItems || []).filter(id => id === itemId).length;
        if (count > 0) {
          UI.drawNum(count, 172, 128, 'cyan');
        }
      }
    };

    const onInputFn = async (input) => {
      if (!state.party || state.party.length === 0) return;
      const partyLen = state.party.length;

      if (input === 'ESC' || input === 'e') {
        ESC.popMenu();
        return;
      }

      if (input === 'up' || input === 'left') {
        selectedPlayerIndex = (selectedPlayerIndex - 1 + partyLen) % partyLen;
        ESC.renderAll();
      } else if (input === 'down' || input === 'right') {
        selectedPlayerIndex = (selectedPlayerIndex + 1) % partyLen;
        ESC.renderAll();
      } else if (input === 'blank') {
        const item = state.items[itemId];
        if (!item) return;

        const targetRole = state.party[selectedPlayerIndex];

        // 步骤 5：运行使用脚本
        state.scriptSuccess = true;
        const nextUseScr = await Script.runTriggerScript(item.useScr, targetRole, 'item');

        // 步骤 6：如果脚本执行成功，扣减道具并更新脚本号
        if (state.scriptSuccess !== false) {
          if (nextUseScr !== undefined) item.useScr = nextUseScr;

          const idx = state.ownItems.indexOf(itemId);
          if (idx > -1) {
            state.ownItems.splice(idx, 1);
          }

          // 重新检查道具在背包中是否耗尽
          const remainingCount = (state.ownItems || []).filter(id => id === itemId).length;
          if (remainingCount === 0) {
            ESC.popMenu(); // 道具耗尽，退回道具列表
          }
        }
        ESC.renderAll();
      }
    };

    ESC.pushMenu('itemUse', null, renderFn, onInputFn);
  },

  onSystem() {
    const systemPanel = PanelFactory.createList([11, 12, 13, 14, 15]);
    systemPanel.x = 28;
    systemPanel.y = 72;
    systemPanel.width = 4;

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
  state.uiMode = 'operate';
  toggleScene(1);
  state.isPaused = false;
}

// 步骤 1.1：静态解析装备脚本以识别其穿戴对应的槽部位 (0-5)
function getItemEquipPart(itemId) {
  const item = state.items[itemId];
  if (!item || !item.equScr) return -1;
  let scriptId = item.equScr;
  // 查找脚本前 5 条指令中对应的 0x18 (equipItem) 穿戴指令
  for (let i = 0; i < 5; i++) {
    const scr = state.scripts[scriptId + i];
    if (scr && scr.code === 0x18) {
      return scr.param1 - 0x0B;
    }
  }
  return -1;
}

// 步骤 1.1：静态提取装备脚本中指定战斗属性 (17-21) 的永久变化数值
function getEquipItemAttributes(itemId) {
  const item = state.items[itemId];
  const attrs = {
    attackStrength: 0,
    magicStrength: 0,
    defense: 0,
    dexterity: 0,
    fleeRate: 0
  };
  if (!item || !item.equScr) return attrs;

  const STAT_MAP = {
    17: 'attackStrength',
    18: 'magicStrength',
    19: 'defense',
    20: 'dexterity',
    21: 'fleeRate'
  };

  let scriptId = item.equScr;
  // 遍历前 10 条指令，读取 0x17 (setPlayerExtraAttribute) 并进行 16 位有符号 short 换算
  for (let i = 0; i < 10; i++) {
    const scr = state.scripts[scriptId + i];
    if (!scr) break;

    // 当遇到脚本终止指令，或遇到非当前道具的装备指令时跳出，防止越界读取下一个道具的脚本属性
    if (scr.code === 0) break;
    if (scr.code === 0x18 && scr.param2 !== itemId) break;

    // 输出装备脚本诊断日志，协助校验属性偏移是否成功
    console.log(`[getEquipItemAttributes] itemId: ${itemId}, nameId: ${item.nameId}, equScr: ${item.equScr}, i: ${i}, code: 0x${scr.code.toString(16)}, param1: ${scr.param1}, param2: ${scr.param2}, param3: ${scr.param3}`);
    if (scr.code === 0x17) {
      const key = STAT_MAP[scr.param2]; // 0x17 指令中，param2 对应属性项 ID (17-21)
      if (key) {
        let val = scr.param3; // 0x17 指令中，param3 对应具体属性加成数值
        if (val > 32767) val -= 65536; // 还原为 JS 中的有符号短整型
        attrs[key] += val;
      }
    }
  }
  return attrs;
}
