<template>
  <template v-if="node">
    <div class="section-title">
      <span>{{ eventName }} 事件动作链</span>
      <el-button type="primary" size="small" icon="Plus" link @click="addAction">添加动作</el-button>
    </div>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      title="动作链说明"
      description="按序执行：刷新数据/打开弹窗需填写目标节点或图层 id；消息提示在 payload 中配置 messageText。"
    />
    <el-alert
      v-for="hint in atomicOutputHints"
      :key="'hint-' + hint.name"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 8px"
      :title="`${hint.label} (${hint.name}) payload`"
      :description="
        (hint.description || '') +
        (hint.samplePaths.length
          ? ' 可引用：' + hint.samplePaths.map((p) => formatEventPath(p)).join('、')
          : '')
      "
    />
    <div v-for="(action, index) in clickActions" :key="action.id" class="config-card">
      <div class="card-row">
        <el-select v-model="action.type" style="width: 150px">
          <el-option v-for="t in actionTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-button type="danger" icon="Delete" circle size="small" @click="removeAction(index)" />
      </div>
      <el-select
        v-model="action.target"
        filterable
        clearable
        placeholder="选择目标组件或图层"
        style="width: 100%; margin-top: 6px"
      >
        <el-option-group label="组件">
          <el-option
            v-for="item in targetNodes"
            :key="item.id"
            :label="`${item.label} (${item.id})`"
            :value="item.id"
          />
        </el-option-group>
        <el-option-group label="图层">
          <el-option
            v-for="layer in designerStore.pageSchema.layers || []"
            :key="layer.id"
            :label="`${layer.name} (${layer.id})`"
            :value="layer.id"
          />
        </el-option-group>
      </el-select>
      <el-input
        v-model="action.when"
        placeholder="条件，如 {{ state.ok === true }}，留空则始终执行"
        style="margin-top: 6px"
      />
      <p v-if="action.when && !whenIsSafe(action.when)" class="field-warning">
        该条件无法安全求值，此动作会被跳过
      </p>
      <el-input
        v-model="action.payloadText"
        type="textarea"
        :rows="2"
        placeholder='payload JSON，如 {"messageText": "已保存"} / {"visible": true}'
        style="margin-top: 6px"
      />
    </div>
    <el-empty v-if="clickActions.length === 0" description="暂未配置 click 动作链" :image-size="60" />
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ActionType, ComponentNode } from '../../types/designer';
import { getOutputPayloadHints } from '../../utils/contractValidator';
import { inlineableExpression } from '../../utils/condition';
import { useDrawerNode } from '../../composables/useDrawerNode';

const { designerStore, node, formatEventPath } = useDrawerNode();

const flattenNodes = (nodes: ComponentNode[] | undefined, acc: Array<{ id: string; label: string }> = []) => {
  for (const item of nodes || []) {
    acc.push({ id: item.id, label: item.label || item.type });
    flattenNodes(item.children, acc);
  }
  return acc;
};

const targetNodes = computed(() => flattenNodes(designerStore.activeChildren));

const actionTypes: Array<{ value: ActionType; label: string }> = [
  { value: 'reload_data', label: '刷新数据' },
  { value: 'open_dialog', label: '打开弹窗' },
  { value: 'close_dialog', label: '关闭弹窗' },
  { value: 'toggle_loading', label: '控制 Loading' },
  { value: 'show_message', label: '消息提示' },
  { value: 'set_state', label: '更新状态' }
];

interface ClickActionForm {
  id: string;
  type: ActionType | '';
  target?: string;
  payloadText: string;
  when?: string;
}

const eventName = computed(() => (node.value?.type === 'pro-form' ? 'submit' : 'click'));
const whenIsSafe = (when: string) => Boolean(inlineableExpression(when));

/** 原子物料事件区 payload 提示（无 materialRef 时也展示） */
const atomicOutputHints = computed(() => {
  if (!node.value || node.value.materialRef) return [];
  return getOutputPayloadHints(node.value.type).filter((h) => h.payloadSchema || h.samplePaths.length);
});

const clickActions = ref<ClickActionForm[]>([]);

watch(
  node,
  (n) => {
    const name = n?.type === 'pro-form' ? 'submit' : 'click';
    const rule = n?.events?.[name];
    clickActions.value = (rule?.actions ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      target: a.target ?? '',
      payloadText: a.payload ? JSON.stringify(a.payload, null, 2) : '',
      when: a.when ?? ''
    }));
  },
  { immediate: true }
);

/** 动作链表单 → node.events.click 同步 */
const syncEvents = () => {
  if (!node.value) return;
  const validActions = clickActions.value
    .filter((a) => a.type)
    .map((a) => {
      let payload: Record<string, any> | undefined;
      try {
        payload = a.payloadText.trim() ? JSON.parse(a.payloadText) : undefined;
      } catch {
        payload = undefined;
      }
      return {
        id: a.id || 'act_' + Date.now().toString(36),
        type: a.type as ActionType,
        target: a.target?.trim() || undefined,
        payload,
        when: a.when?.trim() || undefined
      };
    });
  const next = { ...(node.value.events || {}) };
  if (validActions.length > 0) next[eventName.value] = { enabled: true, actions: validActions };
  else delete next[eventName.value];
  node.value.events = next;
};

watch(clickActions, syncEvents, { deep: true });

const addAction = () => {
  clickActions.value.push({
    id: 'act_' + Date.now().toString(36),
    type: 'show_message',
    payloadText: JSON.stringify({ messageText: '操作完成' }, null, 2)
  });
};

const removeAction = (index: number) => {
  clickActions.value.splice(index, 1);
};
</script>

<style scoped>
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
  color: #303133;
}
.config-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #fafafa;
}
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.field-warning {
  margin: 4px 0 0;
  color: #e6a23c;
  font-size: 12px;
}
</style>
