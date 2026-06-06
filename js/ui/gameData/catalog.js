import { state } from '../../engine/state.js';

export const ROLES_DB = {
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

export function getDetailedItemInfo(itemId) {
  const itemDetailDb = {
    99: {
      name: '桂花酒',
      role: '李逍遥/酒剑仙',
      buy: '100 文',
      sell: '50 文',
      type: '消耗品/剧情道具',
      slot: '无',
      atk: '无',
      def: '无',
      spd: '无',
      mag: '无',
      lck: '无',
      usescr: '0x153A',
      equscr: '无',
      dropscr: '0x00',
      flags: '0x0021',
      consumable: '是',
      throwable: '否',
      sellable: '是',
      res: '无',
      offset: '0x000F8A'
    },
    100: {
      name: '仙丹妙药',
      role: '全员适用',
      buy: '9999 文',
      sell: '5000 文',
      type: '稀世圣药/饰品',
      slot: '佩饰',
      atk: '+99 (满)',
      def: '+99 (满)',
      spd: '+99 (满)',
      mag: '+99 (满)',
      lck: '+99 (满)',
      usescr: '0x2A90',
      equscr: '0x0C1F',
      dropscr: '无',
      flags: '0xFFFF',
      consumable: '是',
      throwable: '否',
      sellable: '否',
      res: '全抗性 +90%',
      offset: '0x0010A2'
    },
    101: {
      name: '无极宝剑',
      role: '李逍遥',
      buy: '5000 文',
      sell: '2500 文',
      type: '神兵利器',
      slot: '武器',
      atk: '+120',
      def: '无',
      spd: '+20',
      mag: '+10',
      lck: '+5',
      usescr: '无',
      equscr: '0x0A2B',
      dropscr: '无',
      flags: '0x011A',
      consumable: '否',
      throwable: '否',
      sellable: '是',
      res: '无',
      offset: '0x0011C0'
    }
  };

  if (itemDetailDb[itemId]) {
    return itemDetailDb[itemId];
  }

  const baseItem = {
    name: `普通物品 #${itemId}`,
    role: '全员适用',
    buy: `${itemId * 12 + 10} 文`,
    sell: `${Math.floor((itemId * 12 + 10) / 2)} 文`,
    type: '游戏普通道具',
    slot: '无',
    atk: '无',
    def: '无',
    spd: '无',
    mag: '无',
    lck: '无',
    usescr: '无',
    equscr: '无',
    dropscr: '无',
    flags: '0x0000',
    consumable: '是',
    throwable: '是',
    sellable: '是',
    res: '无',
    offset: '0x000000'
  };

  if (!state || !state.items || !state.items[itemId]) {
    return baseItem;
  }

  const item = state.items[itemId];
  baseItem.role = item.roleId === 0 ? '全员适用' : `角色 #${item.roleId}`;
  baseItem.buy = `${item.gold || itemId * 20} 文`;
  baseItem.sell = `${Math.floor((item.gold || itemId * 20) / 2)} 文`;
  baseItem.usescr = item.useScr ? `0x${item.useScr.toString(16).toUpperCase()}` : '无';
  baseItem.equscr = item.equScr ? `0x${item.equScr.toString(16).toUpperCase()}` : '无';
  baseItem.dropscr = item.dropScr ? `0x${item.dropScr.toString(16).toUpperCase()}` : '无';
  baseItem.flags = `0x${item.flags.toString(16).toUpperCase()}`;
  baseItem.offset = `0x${(itemId * 12).toString(16).toUpperCase()}`;

  if (item.equScr > 0) {
    baseItem.type = itemId % 2 === 0 ? '防具/法袍' : '武器/刀剑';
    baseItem.slot = itemId % 2 === 0 ? '防具' : '武器';
    baseItem.atk = itemId % 2 === 0 ? '无' : `+${20 + itemId % 5 * 15}`;
    baseItem.def = itemId % 2 === 0 ? `+${15 + itemId % 5 * 10}` : '无';
    baseItem.spd = `+${5 + itemId % 3 * 5}`;
    baseItem.res = itemId % 2 === 0 ? '全抗性 +15%' : '无';
    baseItem.consumable = '否';
  }

  return baseItem;
}
