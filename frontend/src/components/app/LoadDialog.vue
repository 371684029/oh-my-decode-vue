<template>
  <el-dialog :model-value="visible" title="已保存的 JSON 配置列表" width="720px" @update:model-value="emit('update:visible', $event)">
    <el-table :data="schemas" style="width: 100%">
      <el-table-column prop="title" label="页面名称" />
      <el-table-column prop="id" label="页面ID" width="180" />
      <el-table-column label="操作" width="240" align="center">
        <template #default="scope">
          <el-button type="primary" size="small" link @click="handleSelectSchema(scope.row as SavedSchemaRow)">载入</el-button>
          <el-button type="warning" size="small" link @click="handleRestoreSchema(scope.row as SavedSchemaRow)">恢复上一份</el-button>
          <el-button type="danger" size="small" link @click="handleDeleteSchema(scope.row as SavedSchemaRow)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { http } from '../../utils/http';
import { useDesignerStore } from '../../stores/designerStore';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { PageSchema } from '../../types/designer';

/** 已保存页面列表行（/schemas?type=page 返回项） */
interface SavedSchemaRow {
  id: string;
  title?: string;
  type?: string;
}

defineProps<{
  visible: boolean;
  schemas: SavedSchemaRow[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  /** 载入/恢复成功后把完整 Schema 交给父级更新增量保存基线 */
  loaded: [schema: PageSchema];
  deleted: [id: string];
}>();

const designerStore = useDesignerStore();

const handleSelectSchema = async (schema: SavedSchemaRow) => {
  try {
    const res = await http.get(`/schemas/${schema.id}`, { params: { type: schema.type || 'page' } });
    if (!res.data.success) return;
    designerStore.setPageSchema(res.data.data);
    emit('loaded', res.data.data);
    emit('update:visible', false);
    ElMessage.success(`已成功载入配置: ${res.data.data.title}`);
  } catch (err: any) {
    ElMessage.error('载入失败: ' + (err.response?.data?.message || err.message));
  }
};

const handleDeleteSchema = async (schema: SavedSchemaRow) => {
  try {
    await ElMessageBox.confirm(`删除页面「${schema.title || schema.id}」？`, '删除已保存页面', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    const res = await http.delete(`/schemas/${schema.id}`, { params: { type: schema.type || 'page' } });
    if (res.data.success) {
      emit('deleted', schema.id);
      ElMessage.success('已删除');
    }
  } catch (err: any) {
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message));
  }
};

const handleRestoreSchema = async (schema: SavedSchemaRow) => {
  try {
    const type = schema.type || 'page';
    const listed = await http.get(`/schemas/${schema.id}/backups`, { params: { type } });
    const backups = listed.data.data || [];
    if (!backups.length) {
      ElMessage.warning('还没有可恢复的上一份');
      return;
    }
    const res = await http.post(`/schemas/${schema.id}/restore`, { index: backups[0].index }, { params: { type } });
    if (res.data.success) {
      designerStore.setPageSchema(res.data.data);
      emit('loaded', res.data.data);
      emit('update:visible', false);
      ElMessage.success('已恢复上一份');
    }
  } catch (err: any) {
    ElMessage.error('恢复失败: ' + (err.response?.data?.message || err.message));
  }
};
</script>
