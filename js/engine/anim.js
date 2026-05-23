import { Script } from './script.js';
import { refreshRoleCount } from './command.js';

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

  anim2(o, x, y, speed) {
    const cx = o.x;
    const cy = o.y;
    const zx = x;
    const zy = y;

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

      o.x = Math.floor(o.x);
      o.y = Math.floor(o.y);
    });
  }
};
