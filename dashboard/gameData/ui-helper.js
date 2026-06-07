export const React = window.React;
export const ReactDOM = window.ReactDOM;
export const html = window.htm.bind(React.createElement);

// 像素化等比缩放自适应绘制 Canvas 辅助函数
export function drawPixelatedToCanvas(srcCanvas, destCanvas) {
  if (!destCanvas) {
    return;
  }

  const ctx = destCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);

  if (!srcCanvas) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, destCanvas.width - 8, destCanvas.height - 8);
    return;
  }

  // 计算等比缩放因子，并向下取整以防半像素锯齿
  const scale = Math.min(destCanvas.width / srcCanvas.width, destCanvas.height / srcCanvas.height);
  const cleanScale = Math.max(0.5, Math.floor(scale));
  const dx = (destCanvas.width - srcCanvas.width * cleanScale) / 2;
  const dy = (destCanvas.height - srcCanvas.height * cleanScale) / 2;

  ctx.drawImage(srcCanvas, dx, dy, srcCanvas.width * cleanScale, srcCanvas.height * cleanScale);
}

// 统一控制精灵贴图/动画播放周期的自定义 Hook
export function useSpritePlayer({ playSpeed, isPlaying, maxFrames, onFrameChange }) {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (!isPlaying || maxFrames <= 0) return;
    const interval = setInterval(() => {
      setFrame(prev => {
        const next = (prev + 1) % maxFrames;
        if (onFrameChange) onFrameChange(next);
        return next;
      });
    }, playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, maxFrames, playSpeed, onFrameChange]);

  return [frame, setFrame];
}

