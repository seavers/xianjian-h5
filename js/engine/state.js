// 游戏统一状态管理模块，负责存放并共享原来所有的全局运行时变量
export const state = {
  // 游戏画面基准尺寸（320x200，随后自适应缩放）
  WIDTH: 320,
  HEIGHT: 200,

  // 瓦片坐标与实际像素坐标
  mx: 8,
  my: 14,
  mhalf: 0,
  mapX: 0,
  mapY: 0,
  mapId: 12,
  
  // 集中式状态分发：游戏当前的运行交互模式
  currentMode: 'startup',
  // 交互子状态：'block' | 'operate' | 'talk' | 'esc' | 'shop' | 'confirm'
  uiMode: 'operate',
  
  sceneId: -1,
  nextSceneId: -1,
  currentFbpId: -1,     // 当前全屏剧情背景图 ID（-1 表示无）
  needToFadeIn: false,  // 标识是否fadeIn、fadeOut 场景
  fadeAlpha: 0,         // 场景渐变过渡的黑色遮罩透明度（0表示完全透明，1表示完全黑色）
  fadeColor: '0, 0, 0', // 场景渐变过渡遮罩的 RGB 颜色（默认为黑色 '0, 0, 0'，支持红色 '255, 0, 0' 等）
  isPaused: false, // 标识切换过渡期间是否挂起主循环
  
  paletteId: 0,         // 调色板ID
  fNightPalette: false, // 白天 or 黑夜切换

  transitionTask: null, // 场景渐变过渡的同步定时任务对象
  nextTriggerScriptId: -1, // 延迟触发的 trigger 脚本 ID，将在下一 tick 执行
  nextTriggerScriptObject: null, // 延迟触发的 trigger 脚本绑定的实体对象
  fadeOutSpeed: 1,

  startEventId: 0,
  endEventId: 0x20,

  // GOP 动画图片缓存
  images: {},

  // 从 SSS 资源中读取的数据表
  eventObjects: [],
  scripts: [],
  scenes: [],
  items: [],
  words: [],

  // 主角与所有可用角色列表（角色 0-4）
  roles: [
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 2, frame: 0, index: 0, count: 0, spriteNumInBattle: 0, avatar: 1 },
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 3, frame: 0, index: 1, count: 0, spriteNumInBattle: 1, avatar: 11 },
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 7, frame: 0, index: 2, count: 0, spriteNumInBattle: 2, avatar: 21 },
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 525, frame: 0, index: 3, count: 0, spriteNumInBattle: 3, avatar: 73 },
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 5, frame: 0, index: 4, count: 0, spriteNumInBattle: 4, avatar: 27 },
    { type: 'role', x: 0, y: 0, layer: 0, tileId: 26, frame: 0, index: 5, count: 0, spriteNumInBattle: 8, avatar: 44 }
  ],

  // 当前处于队伍中的角色列表
  party: [],

  // 行囊道具列表（ownItems）
  ownItems: [],
  
  // 金钱
  money: 0,

  // 当前战斗背景 ID
  battlefieldId: 0,

  // 当前读写的存档槽位
  currentSaveSlot: 1,

  // 驱魔香/十里香等产生的追逐速度与范围控制
  chasespeedChangeCycles: 0,
  chaseRange: 1,

  // 跟随者数量
  nFollower: 0,

  // 变速齿轮帧数控制（原本为 core-timer.js 中的 frameCount）
  frameCount: 6,

  // 全局逻辑帧计数器，用于部分周期性逻辑（如驱魔香状态下怪兽每两帧原地旋转一次）
  dwFrameNum: 0,

  // 标志当前是否处于敌方行动回合（用来支撑 0x68 jumpIfEnemyTurn 指令判定）
  fEnemyMoving: false,

  // 并行脚本执行历史（用于右侧监控流）
  scriptLogs: [],

  // 当前被高亮追踪的 NPC ID
  highlightNpcId: null,

  // 查看多个模式下的多选 NPC ID 列表
  selectedNpcIds: [],

  // 脚本日志查看模式：'single' (查看单个) 或 'multiple' (查看多个)
  scriptLogMode: 'single',

  // 主角移动历史轨迹，用于跟随者平滑跟随
  roleHistory: [],

  // 各层 Canvas 上下文引用
  contexts: {
    main: null,
    back: null,
    talk: null,
    startup: null,
    fade: null,
    battle: null
  }
};
