<template>
  <div class="page-state-panel">
    <div class="panel-toolbar">
      <span>页面初始状态</span>
      <el-button type="primary" size="small" link @click="addRow">添加状态</el-button>
    </div>
    <p class="hint">键写入页面 state，值使用 JSON。例如键 <code>show</code>，值 <code>false</code>。</p>
    <div v-for="row in rows" :key="row.id" class="state-row">
      <el-input v-model="row.key" placeholder="键名" @change="commitRow(row)" />
      <el-input v-model="row.text" placeholder="JSON 值" @change="commitRow(row)" />
      <el-button size="small" type="danger" link @click="removeRow(row)">删除</el-button>
      <p v-if="row.error" class="field-warning">{{ row.error }}</p>
    </div>
    <el-empty v-if="rows.length === 0" description="还没有页面状态" :image-size="48" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { applyStateEntry, removeStateKey } from '../utils/pageState';

interface StateRow {
  id: string;
  key: string;
  committedKey: string;
  text: string;
  error: string;
}

const designerStore = useDesignerStore();
const rows = ref<StateRow[]>([]);

let seed = 0;
const nextId = () => `state_row_${++seed}`;

const addMissingKeys = () => {
  const state = designerStore.pageSchema.state || {};
  for (const [key, value] of Object.entries(state)) {
    if (rows.value.some((row) => row.committedKey === key || row.key === key)) continue;
    rows.value.push({
      id: nextId(),
      key,
      committedKey: key,
      text: JSON.stringify(value),
      error: ''
    });
  }
};

watch(() => designerStore.pageSchema.state, addMissingKeys, { immediate: true, deep: true });

const addRow = () => {
  rows.value.push({ id: nextId(), key: '', committedKey: '', text: 'false', error: '' });
};

const commitRow = (row: StateRow) => {
  const state = designerStore.pageSchema.state;
  const error = applyStateEntry(state, row.committedKey, row.key, row.text);
  row.error = error ?? '';
  if (!error) row.committedKey = row.key.trim();
};

const removeRow = (row: StateRow) => {
  if (row.committedKey) removeStateKey(designerStore.pageSchema.state, row.committedKey);
  rows.value = rows.value.filter((item) => item.id !== row.id);
};
</script>

<style scoped>
.page-state-panel {
  padding: 8px 0 16px;
}
.panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 13px;
}
.hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
.state-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.field-warning {
  margin: 0;
  color: #e6a23c;
  font-size: 12px;
}
</style>
