import { describe, expect, test } from 'vitest';
import { injectInputs, findOutputFor, mapOutputEvents } from './materialInject';
import type { ComponentNode, MaterialContract } from '../types/designer';

function node(id: string, props: Record<string, unknown> = {}, events: Record<string, any> = {}): ComponentNode {
  return {
    id,
    type: 'el-button',
    label: id,
    layout: { x: 0, y: 0, w: 2, h: 2, i: id },
    props,
    attrs: {},
    style: {},
    events
  };
}

const contract: MaterialContract = {
  inputs: [
    { name: 'title', label: '标题', type: 'string', nodeId: 'n1', fieldPath: 'props.title', required: false },
    { name: 'bad', label: '失效', type: 'string', nodeId: 'missing', fieldPath: 'props.x', required: false }
  ],
  outputs: [{ name: 'submit', label: '提交', nodeId: 'n1', event: 'click' }]
};

describe('injectInputs', () => {
  test('按 nodeId + fieldPath 注入；未配置不注入；失效注入点跳过', () => {
    const snapshot = [node('n1', { title: '默认' })];
    const instance = node('inst', { title: '实例标题', bad: 'x' });
    const out = injectInputs(snapshot, instance, contract);
    expect(out[0].props.title).toBe('实例标题');
    // 原快照不被污染
    expect(snapshot[0].props.title).toBe('默认');
  });

  test('实例未配置的 input 保持快照默认值', () => {
    const snapshot = [node('n1', { title: '默认' })];
    const instance = node('inst', {});
    const out = injectInputs(snapshot, instance, contract);
    expect(out[0].props.title).toBe('默认');
  });
});

describe('findOutputFor / mapOutputEvents', () => {
  test('内部事件匹配 output', () => {
    expect(findOutputFor(contract, 'n1', 'click')?.name).toBe('submit');
    expect(findOutputFor(contract, 'n1', 'change')).toBeNull();
  });

  test('实例绑定 output 时由实例动作链接管', () => {
    const snapshot = [node('n1', {}, { click: { enabled: true, actions: [{ id: 'inner', type: 'show_message' }] } })];
    const instance = node('inst', {}, { submit: { enabled: true, actions: [{ id: 'outer', type: 'set_state' }] } });
    const out = mapOutputEvents(snapshot, instance, contract);
    // 事件 key 被重命名为 output.name，动作链来自实例
    expect(out[0].events.submit).toBeTruthy();
    expect(out[0].events.submit.actions[0].id).toBe('outer');
    expect(out[0].events.click).toBeUndefined();
  });

  test('实例未绑定 output 时保留内部动作链', () => {
    const snapshot = [node('n1', {}, { click: { enabled: true, actions: [{ id: 'inner', type: 'show_message' }] } })];
    const instance = node('inst', {});
    const out = mapOutputEvents(snapshot, instance, contract);
    expect(out[0].events.click.actions[0].id).toBe('inner');
  });
});
