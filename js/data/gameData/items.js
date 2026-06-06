import { state } from '../../engine/state.js';

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
