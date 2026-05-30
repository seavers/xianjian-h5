import { Script } from './script.js';
import { refreshRoleCount, setRolePos } from './command.js';
import { state } from './state.js';

export function calcNpcDir(o, x, y) {
  if (x > o.x && y > o.y) {
    o.dir = 3;
  } else if (x > o.x && y < o.y) {
    o.dir = 2;
  } else if (x < o.x && y > o.y) {
    o.dir = 0;
  } else if (x < o.x && y < o.y) {
    o.dir = 1;
  } else {
    // 某些NPC原地出现时可能会没有方向偏移，不作处理
  }
  refreshRoleCount(o);
}

export const Npc = {
  anim(o, x, y, half, speed) {
    const cx = o.x;
    const cy = o.y;
    const zx = x * 32 + half * 16;
    const zy = y * 16 + half * 8;

    const s = Math.max(Math.abs(zx - cx), Math.abs(zy - cy));
    const step = Math.ceil(s);
    const current = 0;
    const total = Math.ceil(step / speed);

    let curr = current;
    Script.draw(total, () => {
      calcNpcDir(o, zx, zy);
      curr += speed;

      if (step !== 0) {
        o.x = (zx - cx) * curr / step + cx;
        o.y = (zy - cy) * curr / step + cy;
      }

      if (Math.abs(curr) >= s) {
        o.x = zx;
        o.y = zy;
      }
    });
  },

  animTeam(o, x, y, half, speed) {
    const cx = o.x;
    const cy = o.y;
    const zx = x * 32 + half * 16;
    const zy = y * 16 + half * 8;

    const s = Math.max(Math.abs(zx - cx), Math.abs(zy - cy));
    const step = Math.ceil(s);
    const current = 0;
    const total = Math.ceil(step / speed);

    let curr = current;
    Script.draw(total, () => {
      // 1. 计算移动时的朝向，并更新步态动画帧
      calcNpcDir(o, zx, zy);
      curr += speed;

      // 2. 平滑更新移动中每一帧的主角、事件实体与相机视口像素坐标
      if (step !== 0) {
        const nx = (zx - cx) * curr / step + cx;
        const ny = (zy - cy) * curr / step + cy;

        // 同步移动主角（Role 0）的坐标与相机偏移坐标
        state.roles[0].x = nx;
        state.roles[0].y = ny;
        state.mapX = nx;
        state.mapY = ny;

        // 如果传入的首个参数 o 不是主角本身（例如是 eventObject / this），则同步更新其像素坐标
        if (o !== state.roles[0]) {
          o.x = nx;
          o.y = ny;
        }

        // 同步估算当前的瓦片坐标以保持逻辑状态一致
        state.mx = Math.floor(nx / 32);
        state.my = Math.floor(ny / 16);
        state.mhalf = Math.round((nx - state.mx * 32) / 16);
      }
      
      // 3. 移动结束，修正误差并准确对齐到目标像素与瓦片位置
      if (Math.abs(curr) >= s) {
        state.roles[0].x = zx;
        state.roles[0].y = zy;
        state.mapX = zx;
        state.mapY = zy;

        if (o !== state.roles[0]) {
          o.x = zx;
          o.y = zy;
        }

        state.mx = x;
        state.my = y;
        state.mhalf = half;
      }
    });
  },
};
