<template>
  <el-dialog :model-value="visible" title="另存为物料" width="480px" @close="handleClose" @closed="handleClose">
    <el-form label-width="72px">
      <el-form-item label="名称" required>
        <el-input v-model="name" placeholder="例如：用户卡片" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="图标">
        <el-input v-model="icon" placeholder="Element Plus 图标名，如 Avatar / Box" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="category" style="width: 100%">
          <el-option label="自有高端 (pro)" value="pro" />
          <el-option label="Element (element)" value="element" />
          <el-option label="布局 (layout)" value="layout" />
        </el-select>
      </el-form-item>
      <el-form-item label="形态">
        <el-radio-group v-model="mode">
          <el-radio value="expand">展开物料</el-radio>
          <el-radio value="blackbox">黑盒物料（带版本）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="预览">
        <div class="pack-preview">
          <el-tag size="small" type="info">已选 {{ selectedNodes.length }} 个节点</el-tag>
          <el-tag v-for="t in summaryChips" :key="t" size="small" type="success">{{ t }}</el-tag>
          <span v-if="selectedNodes.length === 0" class="empty-hint">请先在画布上选中要打包的组件</span>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="selectedNodes.length === 0" @click="handleSave">
        保存为物料
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useDesignerStore } from '../stores/designerStore';
import { packNodesToManifest } from '../utils/materialPacker';
import { registerMaterial, getMaterial } from '../registry/materialRegistry';
import { clearMaterialCache } from '../utils/materialResolver';
import { http } from '../utils/http';
import type { ComponentNode, MaterialCategory, MaterialVersion } from '../types/designer';

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const designerStore = useDesignerStore();
const name = ref('');
const icon = ref('Box');
const category = ref<MaterialCategory>('pro');
const mode = ref<'expand' | 'blackbox'>('expand');
const saving = ref(false);

/** 从 activeChildren 树收集选中的节点（支持嵌套容器内选中） */
const selectedNodes = computed<ComponentNode[]>(() => {
  const ids = new Set(designerStore.selectedNodeIds);
  const out: ComponentNode[] = [];
  const collect = (list: ComponentNode[]) => {
    for (const node of list) {
      if (ids.has(node.id)) out.push(node);
      if (node.children?.length) collect(node.children);
    }
  };
  collect(designerStore.activeChildren);
  return out;
});

const summaryChips = computed(() => {
  const seen = new Set<string>();
  const chips: string[] = [];
  const walk = (list: ComponentNode[]) => {
    for (const node of list) {
      if (!seen.has(node.type)) {
        seen.add(node.type);
        chips.push(node.type);
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(selectedNodes.value);
  return chips;
});

const handleClose = () => {
  saving.value = false;
  emit('close');
};

const handleSave = async () => {
  try {
    const manifest = packNodesToManifest({
      nodes: selectedNodes.value,
      label: name.value,
      icon: icon.value,
      category: category.value,
      mode: mode.value
    });
    saving.value = true;

    // 已存在同 type → 作为新版本发布（不可变版本，实例不自动升级）
    const existing = getMaterial(manifest.type);
    if (existing) {
      const draft: MaterialVersion = {
        version: existing.currentVersion || '1.0.0',
        schema: manifest.schema || [],
        contract: manifest.contract || existing.contract || { inputs: [], outputs: [] },
        contractSignature: '',
        summary: manifest.summary || [],
        changelog: '',
        publishedAt: '',
        releasedBy: ''
      };
      try {
        await http.put(`/materials/${encodeURIComponent(manifest.type)}/draft`, draft);
        const resp = await http.post(`/materials/${encodeURIComponent(manifest.type)}/versions`, { draft });
        clearMaterialCache();
        ElMessage.success(`已发布新版本 v${resp.data?.data?.version}（${resp.data?.data?.changelog}）`);
      } catch (err: any) {
        ElMessage.error(err?.response?.data?.message || '发布新版本失败');
      } finally {
        saving.value = false;
      }
      emit('close');
      return;
    }

    const reg = registerMaterial(manifest);
    if (!reg.ok) {
      ElMessage.warning(reg.reason);
      saving.value = false;
      return;
    }
    try {
      await http.post('/materials', manifest);
      if (mode.value === 'blackbox') {
        clearMaterialCache();
        ElMessage.success(`黑盒物料已发布 v${manifest.currentVersion}：${manifest.type}`);
      } else {
        ElMessage.success(`物料已保存：${manifest.type}`);
      }
    } catch {
      ElMessage.warning('物料已加入本地面板，但后端保存失败（请确认后端服务已启动）');
    }
    saving.value = false;
    emit('close');
  } catch (err: any) {
    ElMessage.error(err?.message || '打包失败');
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.pack-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 28px;
}
.empty-hint {
  color: #909399;
  font-size: 12px;
}
</style>
