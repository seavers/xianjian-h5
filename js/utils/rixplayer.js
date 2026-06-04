import { DBOPL } from './dbopl.js';

// 音乐寄存器配置及寻址映射常量表
const adflag = new Uint8Array([0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1]);
const reg_data = new Uint8Array([0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21]);
const ad_C0_offs = new Uint8Array([0, 1, 2, 0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8, 6, 7, 8]);

// 通道乐器与音色修改映射辅助表
const modify = new Uint8Array([
  0, 3, 1, 4, 2, 5, 6, 9, 7, 10, 8, 11, 12, 15, 13, 16, 14, 17, 12,
  15, 16, 0, 14, 0, 17, 0, 13, 0
]);

// 节奏打击乐器通道控制数据块
const bd_reg_data = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x08, 0x04, 0x02, 0x01,
  0x00, 0x01, 0x01, 0x03, 0x0F, 0x05, 0x00, 0x01, 0x03, 0x0F, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x01, 0x0F, 0x07, 0x00, 0x02,
  0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A,
  0x04, 0x00, 0x08, 0x0C, 0x0B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x0D, 0x04, 0x00, 0x06, 0x0F, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x0C, 0x00, 0x0F, 0x0B, 0x00, 0x08, 0x05, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x0F, 0x0B, 0x00,
  0x07, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x0F, 0x0B, 0x00, 0x05, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x0F, 0x0B, 0x00, 0x07, 0x05, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00
]);

// 快速数值整型转换辅助器，用于保证有符号数除法及溢出的还原
const toInt32 = (x) => x | 0;
const toInt16 = (x) => (x << 16) >> 16;

export class RixPlayer {
  constructor(oplInstance) {
    // 绑定已实例化的 OPL 核心，方便寄存器写操作
    this.opl = oplInstance;
    
    // 初始化播放状态变量
    this.rix_buf = null;
    this.length = 0;
    this.I = 0;
    this.T = 0;
    this.mus_block = 0;
    this.ins_block = 0;
    this.rhythm = 0;
    this.music_on = 0;
    this.pause_flag = 0;
    this.band = 0;
    this.band_low = 0;
    this.e0_reg_flag = 0;
    this.bd_modify = 0;
    this.sustain = 0;
    this.play_end = 0;
    
    // 分配 RIX 解包缓冲存储结构
    this.f_buffer = new Uint16Array(300);
    this.a0b0_data2 = new Uint16Array(11);
    this.a0b0_data3 = new Uint8Array(18);
    this.a0b0_data4 = new Uint8Array(18);
    this.a0b0_data5 = new Uint8Array(96);
    this.addrs_head = new Uint8Array(96);
    this.insbuf = new Uint16Array(28);
    this.displace = new Uint16Array(11);
    this.reg_bufs = Array.from({ length: 18 }, () => new Uint8Array(14));
    this.for40reg = new Uint8Array(18);
  }

  // 加载 RIX 字节流并初始化寄存器配置
  load(rixData) {
    this.rix_buf = rixData;
    this.length = rixData.length;
    
    // 重置各项状态计数器与指示标志
    this.I = 0;
    this.T = 0;
    this.mus_block = 0;
    this.ins_block = 0;
    this.rhythm = 0;
    this.music_on = 0;
    this.pause_flag = 0;
    this.band = 0;
    this.band_low = 0;
    this.e0_reg_flag = 0;
    this.bd_modify = 0;
    this.sustain = 0;
    this.play_end = 0;

    // 清零并重填寻址及控制缓存
    this.f_buffer.fill(0);
    this.a0b0_data2.fill(0);
    this.a0b0_data3.fill(0);
    this.a0b0_data4.fill(0);
    this.a0b0_data5.fill(0);
    this.addrs_head.fill(0);
    this.insbuf.fill(0);
    this.displace.fill(0);
    for (let i = 0; i < 18; i++) {
      this.reg_bufs[i].fill(0);
    }
    this.for40reg.fill(0x7F);

    // 默认进入 OPL2 兼容状态并初始化基础查找表
    this.ad_bop(1, 32); 
    this.ad_initial();
    
    // 解析乐谱与音色块在 RIX 数据流中的偏移地址
    if (0x0D < this.length) {
      this.rhythm = this.rix_buf[2];
      this.mus_block = (this.rix_buf[0x0D] << 8) + this.rix_buf[0x0C];
      this.ins_block = (this.rix_buf[0x09] << 8) + this.rix_buf[0x08];
      this.I = this.mus_block + 1;
    } else {
      this.I = this.mus_block = this.length;
    }

    // 处理特有打击乐控制状态的初始寄存器偏移
    if (this.rhythm !== 0) {
      this.a0b0_data4[8] = 0;
      this.a0b0_data3[8] = 0x18;
      this.a0b0_data4[7] = 0;
      this.a0b0_data3[7] = 0x1F;
    }
    
    this.bd_modify = 0;
    this.band = 0;
    this.music_on = 1;
  }

  // 往 OPL 音频芯片写入寄存器
  ad_bop(reg, value) {
    this.opl.write(reg & 0xff, value & 0xff);
  }

  // 初始化音高系数查找表及通道映射地址
  ad_initial() {
    let k = 0;
    for (let i = 0; i < 25; i++) {
      let res = Math.floor(Math.floor((i * 24 + 10000) * 52088 / 250000) * 0x24000 / 0x1B503);
      this.f_buffer[i * 12] = (res + 4) >> 3;
      for (let t = 1; t < 12; t++) {
        res = Math.floor(res * 1.06);
        this.f_buffer[i * 12 + t] = (res + 4) >> 3;
      }
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 12; j++) {
        this.a0b0_data5[k] = i;
        this.addrs_head[k] = j;
        k++;
      }
    }
    this.e0_reg_flag = 0x20;
  }

  // 执行一次节拍步进时钟（70Hz），供上层 PCM 混音逻辑周期触发
  update() {
    let band_sus = 1;
    while (band_sus) {
      if (this.sustain <= 0) {
        band_sus = this.rix_proc();
        if (band_sus) {
          this.sustain += band_sus;
        } else {
          this.play_end = 1;
          break;
        }
      } else {
        if (band_sus) {
          this.sustain -= 14; // 扣减时钟节拍，用于进行音符持续时长步退
        }
        break;
      }
    }
    return !this.play_end;
  }

  // 步进处理核心指令流
  rix_proc() {
    let ctrl = 0;
    if (this.music_on === 0 || this.pause_flag === 1) return 0;
    
    this.band = 0;
    while (this.I < this.length && this.rix_buf[this.I] !== 0x80) {
      this.band_low = this.rix_buf[this.I - 1];
      ctrl = this.rix_buf[this.I];
      this.I += 2;
      
      switch (ctrl & 0xF0) {
        case 0x90:
          this.rix_get_ins();
          this.rix_90_pro(ctrl & 0x0F);
          break;
        case 0xA0:
          this.rix_A0_pro(ctrl & 0x0F, this.band_low << 6);
          break;
        case 0xB0:
          this.rix_B0_pro(ctrl & 0x0F, this.band_low);
          break;
        case 0xC0:
          this.switch_ad_bd(ctrl & 0x0F);
          if (this.band_low !== 0) {
            this.rix_C0_pro(ctrl & 0x0F, this.band_low);
          }
          break;
        default:
          this.band = (ctrl << 8) + this.band_low;
          break;
      }
      if (this.band !== 0) return this.band;
    }
    
    // 如果读到终止标志，触发循环重头播放
    this.music_ctrl();
    this.I = this.mus_block + 1;
    this.band = 0;
    this.music_on = 1;
    return 0;
  }

  // 从音色表中抓取当前乐器参数结构块
  rix_get_ins() {
    const offset = this.ins_block + (this.band_low << 6);
    if (offset + 56 >= this.length) return;
    for (let i = 0; i < 28; i++) {
      const o = offset + i * 2;
      this.insbuf[i] = (this.rix_buf[o + 1] << 8) + this.rix_buf[o];
    }
  }

  // 映射乐器音色到对应的 FM 通道及调制器
  rix_90_pro(ctrl_l) {
    if (ctrl_l >= 11) return;
    if (this.rhythm === 0 || ctrl_l < 6) {
      this.ins_to_reg(modify[ctrl_l * 2], this.insbuf, 0, this.insbuf[26]);
      this.ins_to_reg(modify[ctrl_l * 2 + 1], this.insbuf, 13, this.insbuf[27]);
    } else if (ctrl_l > 6) {
      this.ins_to_reg(modify[ctrl_l * 2 + 6], this.insbuf, 0, this.insbuf[26]);
    } else {
      this.ins_to_reg(12, this.insbuf, 0, this.insbuf[26]);
      this.ins_to_reg(15, this.insbuf, 13, this.insbuf[27]);
    }
  }

  // 分发乐器控制命令到寄存器，并执行一次全参数更新
  ins_to_reg(index, insb, insbOffset, value) {
    for (let i = 0; i < 13; i++) {
      this.reg_bufs[index][i] = insb[insbOffset + i];
    }
    this.reg_bufs[index][13] = value & 3;
    
    this.ad_bd_reg();
    this.ad_08_reg();
    this.ad_40_reg(index);
    this.ad_C0_reg(index);
    this.ad_60_reg(index);
    this.ad_80_reg(index);
    this.ad_20_reg(index);
    this.ad_E0_reg(index);
  }

  // 处理频段参数高低值以触发音符音高及状态变更
  rix_A0_pro(ctrl_l, indexVal) {
    if (this.rhythm === 0 || ctrl_l <= 6) {
      this.prepare_a0b0(ctrl_l, indexVal > 0x3FFF ? 0x3FFF : indexVal);
      this.ad_a0b0l_reg(ctrl_l, this.a0b0_data3[ctrl_l], this.a0b0_data4[ctrl_l]);
    }
  }

  // 严格还原有符号溢出除法，模拟 16-bit 移位及模数运算
  prepare_a0b0(index, v) {
    if (index >= 11) return;
    let res1 = toInt32((v - 0x2000) * 0x19);
    let low = toInt32(res1 / 0x2000);
    let high = 0;
    let res = 0;

    if (low < 0) {
      low = toInt32(0x18 - low);
      high = toInt16(low) < 0 ? 0xFFFF : 0;
      res = toInt32((high << 16) + low);
      low = toInt32(toInt16(res) / -25);
      this.a0b0_data2[index] = low;
      low = res;
      res = toInt32(low - 0x18);
      high = toInt16(res) % 0x19;
      low = toInt32(toInt16(res) / 0x19);
      if (high !== 0) {
        low = toInt32(0x19 - high);
      }
    } else {
      res = low;
      high = low;
      low = toInt32(toInt16(res) / 0x19);
      this.a0b0_data2[index] = low;
      res = high;
      low = toInt32(toInt16(res) % 0x19);
    }
    low = toInt32(toInt16(low) * 0x18);
    this.displace[index] = low;
  }

  // 组合发送 A0 及 B0 音符开关与频率参数到 OPL
  ad_a0b0l_reg(index, p2, p3) {
    if (index >= 11) return;
    let i = toInt16(p2 + this.a0b0_data2[index]);
    this.a0b0_data4[index] = p3;
    this.a0b0_data3[index] = p2;
    i = i <= 0x5F ? i : 0x5F;
    i = i >= 0 ? i : 0;

    const idx = this.addrs_head[i] + (this.displace[index] >> 1);
    const data = this.f_buffer[idx];
    
    this.ad_bop(0xA0 + index, data);
    const dataB0 = this.a0b0_data5[i] * 4 + (p3 < 1 ? 0 : 0x20) + ((data >> 8) & 3);
    this.ad_bop(0xB0 + index, dataB0);
  }

  // 更新总衰减和细微音高调节寄存器（B0 端口）
  rix_B0_pro(ctrl_l, indexVal) {
    if (ctrl_l >= 11) return;
    let temp = 0;
    if (this.rhythm === 0 || ctrl_l < 6) {
      temp = modify[ctrl_l * 2 + 1];
    } else {
      temp = ctrl_l > 6 ? ctrl_l * 2 : ctrl_l * 2 + 1;
      temp = modify[temp + 6];
    }
    this.for40reg[temp] = indexVal > 0x7F ? 0x7F : indexVal;
    this.ad_40_reg(temp);
  }

  // 转换打击乐控制位
  rix_C0_pro(ctrl_l, indexVal) {
    const i = indexVal >= 12 ? indexVal - 12 : 0;
    if (ctrl_l < 6 || this.rhythm === 0) {
      this.ad_a0b0l_reg(ctrl_l, i, 1);
    } else {
      if (ctrl_l !== 6) {
        if (ctrl_l === 8) {
          this.ad_a0b0l_reg(ctrl_l, i, 0);
          this.ad_a0b0l_reg(7, i + 7, 0);
        }
      } else {
        this.ad_a0b0l_reg(ctrl_l, i, 0);
      }
      this.bd_modify |= bd_reg_data[ctrl_l];
      this.ad_bd_reg();
    }
  }

  // 释放或切换当前通道为伴奏/节奏通道
  switch_ad_bd(index) {
    if (this.rhythm === 0 || index < 6) {
      this.ad_a0b0l_reg(index, this.a0b0_data3[index], 0);
    } else {
      this.bd_modify &= ~bd_reg_data[index];
      this.ad_bd_reg();
    }
  }

  // 全静音指示器，关闭全部活动发声通道
  music_ctrl() {
    for (let i = 0; i < 11; i++) {
      this.switch_ad_bd(i);
    }
  }

  // 暂停音乐发声
  Pause() {
    this.pause_flag = 1;
    for (let i = 0; i < 11; i++) {
      this.switch_ad_bd(i);
    }
  }

  // 各细化寄存器写入逻辑实现
  ad_E0_reg(index) {
    const data = this.e0_reg_flag === 0 ? 0 : (this.reg_bufs[index][13] & 3);
    this.ad_bop(0xE0 + reg_data[index], data);
  }

  ad_20_reg(index) {
    let data = (this.reg_bufs[index][9] < 1 ? 0 : 0x80);
    data += (this.reg_bufs[index][10] < 1 ? 0 : 0x40);
    data += (this.reg_bufs[index][5] < 1 ? 0 : 0x20);
    data += (this.reg_bufs[index][11] < 1 ? 0 : 0x10);
    data += (this.reg_bufs[index][1] & 0x0F);
    this.ad_bop(0x20 + reg_data[index], data);
  }

  ad_80_reg(index) {
    let data = (this.reg_bufs[index][7] & 0x0F);
    const temp = this.reg_bufs[index][4];
    data |= (temp << 4);
    this.ad_bop(0x80 + reg_data[index], data);
  }

  ad_60_reg(index) {
    let data = (this.reg_bufs[index][6] & 0x0F);
    const temp = this.reg_bufs[index][3];
    data |= (temp << 4);
    this.ad_bop(0x60 + reg_data[index], data);
  }

  ad_C0_reg(index) {
    let data = this.reg_bufs[index][2];
    if (adflag[index] === 1) return;
    data *= 2;
    data |= (this.reg_bufs[index][12] < 1 ? 1 : 0);
    this.ad_bop(0xC0 + ad_C0_offs[index], data);
  }

  ad_40_reg(index) {
    let data = 0x3F - (0x3F & this.reg_bufs[index][8]);
    data *= this.for40reg[index];
    data *= 2;
    data += 0x7F;
    const res = data;
    data = Math.floor(res / 0xFE);
    data -= 0x3F;
    data = -data;
    const temp = this.reg_bufs[index][0];
    data |= (temp << 6);
    this.ad_bop(0x40 + reg_data[index], data);
  }

  ad_bd_reg() {
    let data = this.rhythm < 1 ? 0 : 0x20;
    data |= this.bd_modify;
    this.ad_bop(0xBD, data);
  }

  ad_08_reg() {
    this.ad_bop(8, 0);
  }
}
