<template>
  <template v-if="node && node.materialRef">
    <el-form label-position="top" size="small">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
        :title="`黑盒物料：${node.materialRef.id}`"
        description="实例锁定具体版本；切换版本即升级/回滚，inputs 值注入快照，outputs 为对外事件出口"
      />
      <el-form-item label="当前锁定版本">
        <el-input :model-value="`${node.materialRef.id}@${node.materialRef.version}`" disabled />
      </el-form-item>
      <el-form-item label="切换版本（升级 / 回滚）">
        <div class="version-switch-row">
          <el-select :model-value="node.materialRef.version" style="flex: 1" @change="onSwitchVersion">
            <el-option v-for="v in materialVersions" :key="v" :label="v" :value="v" />
          </el-select>
        </div>
        <div class="version-diff-list">
          <div v-for="v in materialVersions" :key="'diff-' + v" class="version-diff-row">
            <span>{{ v }}</span>
            <el-button
              link
              size="small"
              type="primary"
              :disabled="v === node.materialRef.version"
              @click="showVersionDiff(v)"
            >
              差异
            </el-button>
          </div>
        </div>
        <el-alert
          v-if="versionDiff"
          type="warning"
          show-icon
          :closable="true"
          style="margin-top: 8px"
          :title="`${versionDiff.base} → ${versionDiff.target}（${versionDiff.bump}）`"
          :description="`契约差异 ${versionDiff.contractDiff.length} 项，结构差异 ${versionDiff.schemaDiff.length} 项`"
          @close="versionDiff = null"
        />
      </el-form-item>
      <el-form-item label="跟随策略">
        <el-select v-model="node.materialRef.follow" style="width: 100%">
          <el-option label="精确锁定 (pin)" value="pin" />
          <el-option label="跟随 minor（兼容更新自动生效）" value="minor" />
          <el-option label="跟随 patch（仅补丁自动生效）" value="patch" />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">输入 (inputs)</el-divider>
      <el-form-item v-for="input in materialInputs" :key="input.name" :label="input.label">
        <el-input v-model="node.props[input.name]" :placeholder="`注入到 ${input.nodeId}.${input.fieldPath}`" />
      </el-form-item>
      <el-empty v-if="materialInputs.length === 0" description="该物料未暴露输入" :image-size="40" />

      <el-divider content-position="left">输出 (outputs)</el-divider>
      <div v-for="out in materialOutputs" :key="out.name" class="output-row">
        <div class="output-meta">
          <span>{{ out.label }}</span>
          <p v-if="payloadHintMap[out.name]" class="output-hint">
            {{ payloadHintMap[out.name].description || '事件 payload' }}
            <template v-if="payloadHintMap[out.name].samplePaths.length">
              · 可引用
              <code v-for="p in payloadHintMap[out.name].samplePaths" :key="p">{{ formatEventPath(p) }}</code>
            </template>
          </p>
        </div>
        <el-switch
          :model-value="!!node.events?.[out.name]"
          @change="(val: any) => toggleOutput(out.name, Boolean(val))"
        />
      </div>
      <el-empty v-if="materialOutputs.length === 0" description="该物料未暴露事件出口" :image-size="40" />
      <p class="output-hint">开启后到「事件」标签配置该出口的动作链</p>
    </el-form>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MaterialVersion } from '../../types/designer';
import { getOutputPayloadHints } from '../../utils/contractValidator';
import { resolveMaterial } from '../../utils/materialResolver';
import { http } from '../../utils/http';
import { ElMessage } from 'element-plus';
import { useDrawerNode } from '../../composables/useDrawerNode';

const { designerStore, node, formatEventPath } = useDrawerNode();

// ============================================================
// 黑盒物料实例（v2.1.0）：版本切换 / inputs 注入 / outputs 绑定
// ============================================================
const materialVersion = ref<MaterialVersion | null>(null);
const materialVersions = ref<string[]>([]);
const versionDiff = ref<{
  base: string;
  target: string;
  bump: string;
  contractDiff: unknown[];
  schemaDiff: unknown[];
} | null>(null);
const materialInputs = computed(() => materialVersion.value?.contract?.inputs || []);
const materialOutputs = computed(() => materialVersion.value?.contract?.outputs || []);

const loadMaterialMeta = async () => {
  const ref0 = node.value?.materialRef;
  if (!ref0) {
    materialVersion.value = null;
    materialVersions.value = [];
    versionDiff.value = null;
    return;
  }
  materialVersion.value = await resolveMaterial(ref0);
  try {
    const resp = await http.get(`/materials/${encodeURIComponent(ref0.id)}/versions`);
    materialVersions.value = ((resp.data?.data || []) as Array<{ version: string }>).map((v) => v.version);
  } catch {
    materialVersions.value = [];
  }
};

watch(() => node.value?.id, loadMaterialMeta, { immediate: true });
watch(() => node.value?.materialRef?.version, loadMaterialMeta);

const onSwitchVersion = (v: string) => {
  if (!node.value?.materialRef) return;
  designerStore.recordHistory();
  node.value.materialRef.version = v;
  versionDiff.value = null;
  loadMaterialMeta();
};

const showVersionDiff = async (target: string) => {
  const ref0 = node.value?.materialRef;
  if (!ref0) return;
  try {
    const resp = await http.get(
      `/materials/${encodeURIComponent(ref0.id)}/versions/${encodeURIComponent(target)}/diff`,
      { params: { base: ref0.version } }
    );
    versionDiff.value = resp.data?.data || null;
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '获取版本差异失败');
  }
};

const toggleOutput = (name: string, on: boolean) => {
  const n = node.value;
  if (!n) return;
  designerStore.recordHistory();
  if (!n.events) n.events = {};
  if (on) {
    n.events[name] = { enabled: true, actions: [] };
  } else {
    delete n.events[name];
  }
};

const payloadHintMap = computed(() => {
  const type = node.value?.type;
  if (!type) return {} as Record<string, ReturnType<typeof getOutputPayloadHints>[number]>;
  return Object.fromEntries(getOutputPayloadHints(type).map((h) => [h.name, h]));
});
</script>

<style scoped>
.output-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  gap: 8px;
}
.output-meta {
  flex: 1;
  min-width: 0;
}
.output-hint {
  margin: 4px 0 0;
  color: #909399;
  font-size: 12px;
}
.output-hint code {
  margin-left: 4px;
  padding: 0 4px;
  background: #f4f4f5;
  border-radius: 3px;
  font-size: 11px;
}
.version-switch-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.version-diff-list {
  margin-top: 8px;
  max-height: 140px;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 4px 8px;
}
.version-diff-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
}
</style>
