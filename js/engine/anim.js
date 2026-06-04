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

    const dx = zx - cx;
    const dy = zy - cy;
    const absDy = Math.abs(dy);

    // 计算移动时的朝向，并更新步态动画帧
    calcNpcDir(o, zx, zy);

    if (absDy > speed) {
      o.x = cx + Math.sign(dx) * speed * 2;
      o.y = cy + Math.sign(dy) * speed;
      return absDy - speed; // 未到站，返回剩余像素距离（非 0）以安全挂起指令
    } else {
      o.x = zx;
      o.y = zy;
      return 0; // 已到站，返回 0 结束当前移动指令
    }
  },

  animTeam(o, x, y, half, speed) {
    const cx = o.x;
    const cy = o.y;
    const zx = x * 32 + half * 16;
    const zy = y * 16 + half * 8;

    const dx = zx - cx;
    const dy = zy - cy;
    const absDy = Math.abs(dy);

    // 1. 计算移动时的朝向，并更新步态动画帧
    calcNpcDir(o, zx, zy);

    if (absDy > speed) {
      const nx = cx + Math.sign(dx) * speed * 2;
      const ny = cy + Math.sign(dy) * speed;

      const leader = state.party[0] || state.roles[0];
      // 不是主角，只移动位置
      if (leader !== o) {
        o.x = nx;
        o.y = ny;
        return absDy - speed;
      }
      
      // 同步移动主角（Role 0）的坐标与相机偏移坐标
      if (leader) {
        leader.x = nx;
        leader.y = ny;
      }
      state.mapX = nx;
      state.mapY = ny;

      // 同步估算当前的瓦片坐标以保持逻辑状态一致
      state.mx = Math.floor(nx / 32);
      state.my = Math.floor(ny / 16);
      state.mhalf = Math.round((nx - state.mx * 32) / 16);

      return absDy - speed; // 未到站，返回剩余像素距离（非 0）以安全挂起指令
    } else {
      // 3. 移动结束，修正误差并准确对齐到目标像素与瓦片位置
      const leader = state.party[0] || state.roles[0];
      if (leader) {
        leader.x = zx;
        leader.y = zy;
      }
      state.mapX = zx;
      state.mapY = zy;

      if (o !== leader) {
        o.x = zx;
        o.y = zy;
      }

      state.mx = x;
      state.my = y;
      state.mhalf = half;

      return 0; // 已到站，返回 0 结束当前移动指令
    }
  },
};
