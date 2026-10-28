<template>
  <template v-if="node">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      title="接口数据源绑定"
      description="配置后组件从接口取数；URL/参数支持表达式。清空 URL 即恢复占位数据。"
    />
    <el-form label-position="top" size="small">
      <el-form-item label="接口 URL">
        <el-input v-model="apiForm.url" placeholder="/api/users 或 https://example.com/users" />
      </el-form-item>
      <el-form-item label="请求方法">
        <el-radio-group v-model="apiForm.method">
          <el-radio value="GET">GET</el-radio>
          <el-radio value="POST">POST</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        label="请求参数 (JSON)"
        :error="paramsError ? '参数不是合法的 JSON 对象，已保留上次的参数' : ''"
      >
        <el-input
          v-model="apiForm.paramsText"
          type="textarea"
          :rows="4"
          placeholder='{"page": 1, "size": 10}'
        />
      </el-form-item>
      <el-form-item label="响应数据路径">
        <el-input v-model="apiForm.responsePath" placeholder="data.list" />
      </el-form-item>
      <el-form-item label="分页总数路径">
        <el-input v-model="apiForm.totalProp" placeholder="data.total" />
      </el-form-item>
      <el-form-item label="挂载时自动请求">
        <el-switch v-model="apiForm.autoFetch" />
      </el-form-item>
      <div class="card-row">
        <el-button type="primary" size="small" icon="Refresh" @click="handleTestRequest">试请求并预览</el-button>
        <el-button v-if="hasApiBinding" type="warning" size="small" icon="Delete" @click="clearApiBinding">
          清除数据源
        </el-button>
      </div>
    </el-form>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ApiExecutor, nodeEventBus } from '../../utils/dataSource';
import { mergeApiBinding } from '../../utils/apiBindingForm';
import { ElMessage } from 'element-plus';
import { useDrawerNode } from '../../composables/useDrawerNode';

const { designerStore, node } = useDrawerNode();

// ---------------------------------------------------------------------------
// 数据源 Tab (L2)
// ---------------------------------------------------------------------------

interface ApiFormState {
  url: string;
  method: 'GET' | 'POST';
  paramsText: string;
  responsePath: string;
  totalProp: string;
  autoFetch: boolean;
}

const apiForm = ref<ApiFormState>({
  url: '',
  method: 'GET',
  paramsText: '{}',
  responsePath: '',
  totalProp: '',
  autoFetch: true
});
const paramsError = ref(false);

const hasApiBinding = computed(() => !!node.value?.apiBinding?.url);

watch(
  () => ({ id: node.value?.id, binding: node.value?.apiBinding }),
  (next, prev) => {
    if (!node.value) return;
    const bindingUrl = next.binding?.url ?? '';
    const sameNode = !!prev && next.id === prev.id;
    if (sameNode && apiForm.value.url.trim() === bindingUrl) return;
    paramsError.value = false;
    const binding = next.binding;
    apiForm.value = {
      url: binding?.url ?? '',
      method: binding?.method ?? 'GET',
      paramsText: binding?.params ? JSON.stringify(binding.params, null, 2) : '{}',
      responsePath: binding?.responsePath ?? '',
      totalProp: binding?.totalProp ?? '',
      autoFetch: binding?.autoFetch ?? true
    };
  },
  { immediate: true }
);

/** 表单状态 → node.apiBinding 同步 */
const syncApiBinding = () => {
  if (!node.value) return;
  const { binding, paramsError: invalid } = mergeApiBinding(node.value.apiBinding, apiForm.value);
  paramsError.value = invalid;
  if (JSON.stringify(node.value.apiBinding ?? null) === JSON.stringify(binding ?? null)) return;
  node.value.apiBinding = binding;
};

watch(apiForm, syncApiBinding, { deep: true });

const handleTestRequest = async () => {
  syncApiBinding();
  const binding = node.value?.apiBinding;
  if (!binding?.url) {
    ElMessage.warning('请先配置接口 URL');
    return;
  }
  try {
    const executor = new ApiExecutor(designerStore.pageSchema.state);
    const { data } = await executor.fetchData(binding);
    const count = Array.isArray(data) ? data.length : data && typeof data === 'object' ? Object.keys(data).length : 0;
    ElMessage.success(`请求成功，返回${Array.isArray(data) ? '数组 ' + count + ' 条' : '对象 ' + count + ' 字段'}`);
    nodeEventBus.emitReload(node.value!.id);
  } catch (err: any) {
    ElMessage.error('请求失败: ' + (err.message || err));
  }
};

const clearApiBinding = () => {
  if (node.value) {
    node.value.apiBinding = undefined;
  }
  apiForm.value = { url: '', method: 'GET', paramsText: '{}', responsePath: '', totalProp: '', autoFetch: true };
  paramsError.value = false;
};
</script>

<style scoped>
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
