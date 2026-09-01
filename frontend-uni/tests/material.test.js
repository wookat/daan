import { describe, it, expect } from 'vitest';
import { splitMaterial, sameMaterial } from '../src/material.js';

const MAT = '2024年某省粮食总产量为3850万吨，比上年增长4.2%；其中夏粮产量1540万吨，比上年增长6.5%；秋粮产量2310万吨。全省粮食播种面积6160万亩，比上年增长1.5%。2023年该省粮食总产量中夏粮占比约39.1%。全省农业总产值8200亿元，比上年增长5.3%，其中种植业产值4100亿元。';

describe('splitMaterial', () => {
  it('切分材料与「问题：」小题干', () => {
    const r = splitMaterial(`根据下列材料回答问题。${MAT}\n问题：2024年夏粮产量占比为：`);
    expect(r).toBeTruthy();
    expect(r.material).toContain('根据下列材料回答问题');
    expect(r.stem).toBe('问题：2024年夏粮产量占比为：');
  });

  it('支持半角冒号与【资料】前缀', () => {
    const r = splitMaterial(`【资料】${MAT}问题: 下列说法正确的是？`);
    expect(r).toBeTruthy();
    expect(r.stem).toBe('问题: 下列说法正确的是？');
  });

  it('无「问题：」分隔符返回 null', () => {
    expect(splitMaterial(`${MAT}下列说法正确的是？`)).toBeNull();
  });

  it('材料去空白不足 120 字返回 null', () => {
    expect(splitMaterial('短材料。\n问题：下列说法正确的是？')).toBeNull();
  });

  it('空入参返回 null', () => {
    expect(splitMaterial('')).toBeNull();
    expect(splitMaterial(null)).toBeNull();
  });
});

describe('sameMaterial', () => {
  it('同材料不同小题判定为同组', () => {
    expect(sameMaterial(`${MAT}问题：第一小题？`, `${MAT}问题：第二小题？`)).toBe(true);
  });

  it('材料仅空白差异仍判同组', () => {
    expect(sameMaterial(`${MAT}问题：第一小题？`, `${MAT.replace('；', '；\n')}问题：第二小题？`)).toBe(true);
  });

  it('不同材料判定为异组', () => {
    expect(sameMaterial(`${MAT}问题：第一小题？`, `${MAT.replace('3850', '9999')}问题：第二小题？`)).toBe(false);
  });

  it('任一侧切分失败判定为异组', () => {
    expect(sameMaterial(`${MAT}问题：第一小题？`, '短题干无材料？')).toBe(false);
  });
});
