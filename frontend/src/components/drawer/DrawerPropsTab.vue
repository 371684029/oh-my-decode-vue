<template>
  <template v-if="node">
    <el-alert
      v-if="missingFields.length > 0"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      :title="`剩余 ${missingFields.length} 项必填参数未配置`"
      :description="missingFields.map((field) => field.label).join('、')"
    />
    <el-alert
      v-for="issue in propIoIssues"
      :key="'io-' + issue.name + issue.message"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 8px"
      :title="issue.message"
    />
    <el-form label-position="top" size="small">
      <el-form-item label="组件标识 (ID)">
        <el-input v-model="node.id" disabled />
      </el-form-item>
      <el-form-item label="组件显示名称">
        <el-input v-model="node.label" />
      </el-form-item>
      <el-form-item label="显隐条件">
        <el-input v-model="node.visibleWhen" placeholder="留空始终显示，例如 {{ state.show === true }}" />
        <p v-if="visibleWhenWarning" class="field-warning">{{ visibleWhenWarning }}</p>
      </el-form-item>

      <!-- ProTable 属性 -->
      <template v-if="node.type === 'pro-table'">
        <el-form-item label="显示边框 (Border)">
          <el-switch v-model="node.props.border" />
        </el-form-item>
        <el-form-item label="斑马纹 (Stripe)">
          <el-switch v-model="node.props.stripe" />
        </el-form-item>
        <el-form-item label="尺寸 (Size)">
          <el-select v-model="node.props.size" style="width: 100%">
            <el-option label="大" value="large" />
            <el-option label="默认" value="default" />
            <el-option label="小" value="small" />
          </el-select>
        </el-form-item>
      </template>

      <!-- ProForm 属性 -->
      <template v-if="node.type === 'pro-form'">
        <el-form-item label="Label 宽度">
          <el-input v-model="node.props.labelWidth" />
        </el-form-item>
        <el-form-item label="表单布局方式">
          <el-radio-group v-model="node.props.layout">
            <el-radio value="horizontal">水平</el-radio>
            <el-radio value="inline">内联</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="行间距 itemGap (px)">
          <el-input-number v-model="node.props.itemGap" :min="0" :max="64" style="width: 100%" />
        </el-form-item>
        <el-form-item label="列间距 gutter">
          <el-input-number v-model="node.props.gutter" :min="0" :max="48" style="width: 100%" />
        </el-form-item>
      </template>

      <template v-if="node.type === 'pro-spacer'">
        <el-form-item label="高度">
          <el-input v-model="node.props.height" placeholder="如 24px / 2rem" />
        </el-form-item>
        <el-form-item label="设计态显示轮廓">
          <el-switch v-model="node.props.designOnlyOutline" />
        </el-form-item>
      </template>

      <!-- el-button 属性 -->
      <template v-if="node.type === 'el-button'">
        <el-form-item label="按钮文案">
          <el-input v-model="node.props.text" placeholder="支持绑定表达式，如 {{ '提交' }}" />
          <div v-if="node.props.text && node.props.text.includes('{{')" class="expression-preview">
            <span class="preview-label">表达式实时计算结果：</span>
            <span class="preview-val">{{ getExpressionPreview(node.props.text) }}</span>
          </div>
        </el-form-item>
        <el-form-item label="按钮类型">
          <el-select v-model="node.props.type" style="width: 100%">
            <el-option label="主要" value="primary" />
            <el-option label="成功" value="success" />
            <el-option label="警告" value="warning" />
            <el-option label="危险" value="danger" />
          </el-select>
        </el-form-item>
      </template>

      <!-- el-card 属性 -->
      <template v-if="node.type === 'el-card'">
        <el-form-item label="卡片标题">
          <el-input v-model="node.props.header" />
        </el-form-item>
        <el-form-item label="阴影时机">
          <el-select v-model="node.props.shadow" style="width: 100%">
            <el-option label="总是" value="always" />
            <el-option label="悬停" value="hover" />
            <el-option label="从不" value="never" />
          </el-select>
        </el-form-item>
      </template>

      <!-- el-tag 属性 -->
      <template v-if="node.type === 'el-tag'">
        <el-form-item label="标签文案">
          <el-input v-model="node.props.text" />
        </el-form-item>
        <el-form-item label="标签类型">
          <el-select v-model="node.props.type" style="width: 100%">
            <el-option label="成功" value="success" />
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="危险" value="danger" />
          </el-select>
        </el-form-item>
      </template>

      <!-- el-alert 属性 -->
      <template v-if="node.type === 'el-alert'">
        <el-form-item label="提示标题">
          <el-input v-model="node.props.title" />
        </el-form-item>
        <el-form-item label="提示类型">
          <el-select v-model="node.props.type" style="width: 100%">
            <el-option label="成功" value="success" />
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="错误" value="error" />
          </el-select>
        </el-form-item>
      </template>

      <!-- el-divider 属性 -->
      <template v-if="node.type === 'el-divider'">
        <el-form-item label="分割线文案">
          <el-input v-model="node.props.text" />
        </el-form-item>
        <el-form-item label="文案位置">
          <el-select v-model="node.props.contentPosition" style="width: 100%">
            <el-option label="靠左" value="left" />
            <el-option label="居中" value="center" />
            <el-option label="靠右" value="right" />
          </el-select>
        </el-form-item>
      </template>
    </el-form>

    <el-divider content-position="left">原生 Attrs</el-divider>
    <div class="section-title">
      <span>透传 Attrs (Key-Value)</span>
    </div>
    <div v-for="(_val, key) in node.attrs" :key="key" class="card-row" style="margin-bottom: 8px">
      <el-input :model-value="String(key)" disabled style="width: 140px" />
      <el-input v-model="node.attrs[key]" placeholder="Value" />
    </div>
    <el-empty v-if="!node.attrs || Object.keys(node.attrs).length === 0" description="暂无原生 Attrs" :image-size="40" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { parseExpression } from '../../utils/expression';
import { missingRequiredFields } from '../../registry/materialContract';
import { validateComponentProps } from '../../utils/contractValidator';
import { inlineableExpression } from '../../utils/condition';
import { useDrawerNode } from '../../composables/useDrawerNode';

const { designerStore, node } = useDrawerNode();

const getExpressionPreview = (exprStr: string) => {
  try {
    return parseExpression(exprStr, designerStore.pageSchema.state || {});
  } catch (err: any) {
    return '求值出错: ' + err.message;
  }
};

const missingFields = computed(() => (node.value ? missingRequiredFields(node.value) : []));
/** 必填/类型 IO 警告（与 missingFields 互补；类型问题单独展示，必填去重） */
const propIoIssues = computed(() => {
  if (!node.value) return [];
  const missingNames = new Set(missingFields.value.map((f) => f.name));
  return validateComponentProps(node.value).filter((issue) => !missingNames.has(issue.name) || issue.message.includes('期望类型'));
});
const visibleWhenWarning = computed(() => {
  const raw = node.value?.visibleWhen?.trim();
  if (!raw) return '';
  return inlineableExpression(raw) ? '' : '显隐表达式无法安全求值，组件将保持显示';
});
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
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.expression-preview {
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #f4f4f5;
  border-radius: 4px;
  font-size: 11px;
  color: #606266;
}
.preview-label {
  color: #909399;
}
.preview-val {
  color: #409eff;
  font-weight: 600;
}
.field-warning {
  margin: 4px 0 0;
  color: #e6a23c;
  font-size: 12px;
}
</style>
