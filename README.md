# 仙剑奇侠传 HTML5

> 🎮 基于 HTML5 Canvas 的《仙剑奇侠传 DOS 版》全功能 Web 复刻

**在线体验**：[https://seavers.github.io/xianjian-h5/](https://seavers.github.io/xianjian-h5/)

---

## 项目简介

本项目使用纯 JavaScript + HTML5 Canvas 技术，从零解析《仙剑奇侠传》DOS 版的 MKF 资源文件，并通过 JS 实现了原版脚本指令的解析与驱动执行，在浏览器中完整复刻了这款经典 RPG 的游戏体验。

无需安装任何插件或模拟器，打开浏览器即可游玩。

---

## 核心特性

- ✅ **MKF 资源解析**：支持 YJ_1 / RLE 解压缩算法，完整解包原版 `.mkf` 归档文件
- ✅ **原版脚本引擎**：精确解析并执行仙剑全部脚本指令（`sss.mkf` 五大数据块）
- ✅ **地图与场景**：等角菱形 Tile 地图渲染、场景切换、多层遮挡排序
- ✅ **角色与 NPC**：精灵动画、行走移动、碰撞检测、触发交互
- ✅ **对话系统**：Big5 → 简体中文转码，支持多行对话、颜色标注、选择分支
- ✅ **ESC 菜单系统**：状态查看、道具管理、装备穿戴、系统设置
- ✅ **商店系统**：购买 / 出售完整交互流程
- ✅ **存档系统**：支持多存档位的读取与保存（localStorage）
- ✅ **战斗系统**：回合制战斗引擎，含物理攻击、法术施放、合击技、道具使用、逃跑等
- ✅ **音乐与音效**：通过 Web Audio API + OPL 合成器播放原版 RIX 背景音乐及 VOC / WAV 音效
- ✅ **移动端适配**：支持触摸操作，可添加至主屏幕作为 Web App 运行

---

## 技术架构

```
xianjian-h5/
├── index.html              # 主入口（含 Canvas 画布 + 开发者调试面板）
├── pal/                    # 仙剑 DOS 原版资源文件（MKF / FON / DAT 等）
├── js/
│   ├── app.js              # 应用入口：资源加载、数据初始化、主循环启动
│   ├── engine/             # 🎯 游戏引擎核心
│   │   ├── state.js        #    全局状态管理（角色、场景、地图坐标等）
│   │   ├── script.js       #    脚本执行引擎（线程调度、主循环驱动）
│   │   ├── command.js       #    脚本指令实现（对话、场景切换、战斗触发等 ~3400 行）
│   │   ├── anim.js          #    NPC / 角色精灵动画管理
│   │   ├── rng.js           #    RNG 过场动画播放器
│   │   ├── role.js          #    角色属性存取封装
│   │   └── thread.js        #    脚本线程数据结构
│   ├── battle/             # ⚔️ 战斗系统
│   │   ├── battle.js        #    回合制战斗引擎（状态机、AI、伤害、渲染 ~4300 行）
│   │   └── battleData.js    #    战斗数据加载（敌人、阵型、法术、精灵帧）
│   ├── ui/                 # 🖼️ 界面绘制
│   │   ├── draw.js          #    地图与场景渲染（Tile 绘制、遮挡层级）
│   │   ├── panel.js         #    通用 UI 面板（画卷贴图框架）
│   │   ├── talk.js          #    对话 UI（文字渲染、翻页、选项）
│   │   ├── shop.js          #    商店交互界面
│   │   ├── input.js         #    键盘 / 触摸统一输入层
│   │   ├── fade.js          #    画面淡入淡出过渡效果
│   │   ├── confirm.js       #    确认对话框
│   │   ├── selectRole.js    #    角色选择菜单
│   │   ├── useItemMenu.js   #    道具使用菜单
│   │   ├── clearWithEffect.js #  画面清屏特效
│   │   └── colors.js        #    调色板颜色常量
│   ├── esc/                # 📋 ESC 系统菜单
│   │   ├── esc.js           #    ESC 主菜单（状态、道具、装备、存档等）
│   │   └── archive.js       #    存档读写（序列化 / 反序列化全部游戏状态）
│   ├── resources/          # 📦 资源管理
│   │   ├── loader.js        #    MKF 文件加载器（同步 XHR + ArrayBuffer）
│   │   ├── pal.js           #    图片 / 字体 / 地图 / 精灵资源解包与缓存
│   │   ├── music.js         #    OPL 合成 RIX 背景音乐播放（Web Audio API）
│   │   └── sound.js         #    VOC / WAV 音效播放
│   ├── utils/              # 🔧 工具库
│   │   ├── deyj.js          #    YJ_1 解压缩算法实现
│   │   ├── view.js          #    字节流读取工具（ByteArray / DataView）
│   │   ├── canvas.js        #    Canvas 辅助函数
│   │   ├── hex.js           #    十六进制格式化
│   │   ├── t2s.js           #    繁简中文转换
│   │   ├── dbopl.js         #    OPL3 芯片模拟器（DosBox 移植）
│   │   ├── rixplayer.js     #    RIX 音乐格式播放器
│   │   ├── timer.js         #    异步计时器
│   │   ├── number.js        #    数值转换工具
│   │   └── lang.js          #    语言工具函数
│   └── vendor/             # 📚 第三方依赖
│       ├── react.production.min.js
│       ├── react-dom.production.min.js
│       └── htm.umd.js
└── dashboard/              # 🛠️ 开发者调试面板
    ├── dashboardRuntime.js  #    实时控制台（角色状态、背包、场景监控）
    ├── battleDataUI.js      #    战斗资料浏览器（敌人、法术、阵型数据）
    ├── imageExplorer.js     #    精灵资源浏览器（MKF 全量图片解包展示）
    ├── sceneTools.js        #    场景调试工具
    ├── scriptLogPanel.js    #    脚本执行日志面板
    ├── stepDebugger.js      #    脚本单步调试器
    ├── mapModal.js          #    地图跳转弹窗
    ├── debugActions.js      #    调试快捷操作
    └── gameData/            #    游戏数据 Tab 页
        └── tabs/
            ├── roleTab.js   #    角色资料页
            ├── itemTab.js   #    道具资料页
            ├── npcTab.js    #    NPC 资料页
            ├── sceneTab.js  #    场景资料页
            └── scriptTab.js #    脚本资料页
```

---

## 资源文件说明

游戏运行需要《仙剑奇侠传》DOS 版的原版资源文件，放置于 `pal/` 目录下：

| 文件 | 说明 |
|------|------|
| `gop.mkf` | 角色 / NPC 行走精灵图 |
| `mgo.mkf` | 附加动画精灵图 |
| `map.mkf` | 全部地图数据 |
| `sss.mkf` | 核心数据表（NPC、场景、道具、角色位置、脚本指令） |
| `rgm.mkf` | 角色头像图 |
| `pat.mkf` | 调色板数据 |
| `data.mkf` | 数据块（角色属性、敌人、法术、商店等） |
| `m.msg` | 对话文本（Big5 编码） |
| `rng.mkf` | 过场动画数据 |
| `fbp.mkf` | 全屏背景图 |
| `fire.mkf` | 法术特效动画 |
| `abc.mkf` | 战斗角色精灵 |
| `ball.mkf` | 战斗投掷物精灵 |
| `f.mkf` | 战场背景图 |
| `wor16.fon` | 16×16 像素 Big5 中文点阵字体 |
| `word.dat` | 词表数据 |
| `desc.dat` | 道具描述文本 |
| `midi.mkf` / `mus.mkf` | 背景音乐（RIX 格式） |
| `sounds.mkf` / `voc.mkf` | 音效文件 |

---

## 快速开始

1. 将仙剑 DOS 版原版资源文件放入 `pal/` 目录
2. 启动一个本地 HTTP 服务器（资源加载依赖 XHR，不支持 `file://` 协议）：

```bash
# 方式一：Python
python3 -m http.server 8080

# 方式二：Node.js
npx serve .
```

3. 在浏览器中打开 `http://localhost:8080`

### Debug 模式

在 URL 后添加 `?debug=1` 参数可直接加载存档 1 进入游戏，跳过开场动画：

```
http://localhost:8080?debug=1
```

---

## 致谢

- 仙剑奇侠传（1995）—— 大宇资讯 / SoftStar
- [SDLPal](https://github.com/sdlpal/sdlpal) —— 仙剑 DOS 版 C 语言跨平台移植项目，本项目参考了其对 MKF / 脚本 / 战斗等子系统的还原实现

---

## 许可证

本项目为个人学习研究项目，仅用于技术交流。游戏资源版权归原始版权方所有。
