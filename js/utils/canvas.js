export const Canvas = {
  // 利用字节数组生成 canvas 对象，每个字节/数值为一个 32 位 RGBA 像素数据
  create(data, width, height) {
    // 步骤1：检查参数合法性，防止传入 NaN 或非数字导致 ImageData 创建失败
    if (typeof width !== 'number' || typeof height !== 'number' || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      console.error(`Canvas.create: invalid size width=${width}, height=${height}`);
      width = 1;
      height = 1;
      data = [0];
    }

    // 步骤2：向下取整，确保宽和高是 32 位整型 (long)
    width = Math.floor(width);
    height = Math.floor(height);

    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');

    const image = ctx.createImageData(width, height);
    const pixels = image.data;
    
    // 步骤3：循环填充每个像素的 RGBA 通道值
    for (let i = 0; i < width * height; i++) {
      // 在原代码中数据可能采用的是 BGRA/RGBA 的某种特定排列
      pixels[i * 4 + 2] = (data[i] & 0x000000FF) >> 0;  // blue
      pixels[i * 4 + 1] = (data[i] & 0x0000FF00) >> 8;  // green
      pixels[i * 4 + 0] = (data[i] & 0x00FF0000) >> 16; // red
      pixels[i * 4 + 3] = ((data[i] & 0xFF000000) >> 24) & 0xFF; // alpha
    }

    ctx.putImageData(image, 0, 0);
    return c;
  }
};
