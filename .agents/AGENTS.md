# Custom Rules

- 不要在游戏里自己绘制文字与图形，都是用贴图方式。文字应通过 state.words 配套的 drawWordToCtx 绘制，数值属性应通过 drawWinNumber 绘制，画卷背景应当通过 UI.drawSingleLineBox 等贴图接口绘制。
