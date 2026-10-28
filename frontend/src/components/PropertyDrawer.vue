<template>
  <aside v-show="designerStore.isDrawerOpen" class="inspector-pane">
    <header class="inspector-header">
      <span class="inspector-title">组件配置</span>
      <el-button text type="info" size="small" @click="handleClose">关闭</el-button>
    </header>
    <div class="inspector-body">
    <template v-if="node">
      <el-tabs v-model="activeTab" class="drawer-tabs">
        <!-- 属性配置 Tab -->
        <el-tab-pane label="属性 Props" name="props">
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
        </el-tab-pane>

        <!-- 高级配置 Tab (ProTable/ProForm 专属) -->
        <el-tab-pane v-if="node.config" label="高级 Config" name="config">
          <!-- ProTable 特有配置 -->
          <div v-if="node.type === 'pro-table'" class="config-section">
            <div class="section-title">
              <span>表格列配置 (Columns)</span>
              <el-button type="primary" size="small" icon="Plus" link @click="addTableColumn"> 添加列 </el-button>
            </div>
            <div v-for="(col, index) in node.config.columns" :key="index" class="config-card">
              <el-input v-model="col.label" placeholder="列名" style="margin-bottom: 6px" />
              <el-input v-model="col.prop" placeholder="字段 (prop)" style="margin-bottom: 6px" />
              <div class="card-row">
                <el-input v-model="col.width" placeholder="宽度(px)" style="width: 110px" />
                <el-switch v-model="col.sortable" active-text="排序" />
                <el-button link size="small" :disabled="index === 0" @click="moveTableColumn(Number(index), -1)">上移</el-button>
                <el-button
                  link
                  size="small"
                  :disabled="index === node.config.columns.length - 1"
                  @click="moveTableColumn(Number(index), 1)"
                >
                  下移
                </el-button>
                <el-button type="danger" icon="Delete" circle size="small" @click="removeTableColumn(Number(index))" />
              </div>
            </div>
          </div>

          <!-- ProForm 特有配置 -->
          <div v-if="node.type === 'pro-form'" class="config-section">
            <div class="section-title">
              <span>表单项配置 (Items)</span>
              <el-button type="primary" size="small" icon="Plus" link @click="addFormItem"> 添加项 </el-button>
            </div>
            <div v-for="(item, index) in node.config.items" :key="index" class="config-card">
              <el-input v-model="item.label" placeholder="Label" style="margin-bottom: 6px" />
              <el-input v-model="item.field" placeholder="字段名 (field)" style="margin-bottom: 6px" />
              <div class="card-row">
                <el-select
                  v-model="item.component"
                  placeholder="控件类型"
                  style="width: 140px"
                  @change="onFormComponentChange(item)"
                >
                  <el-option label="输入框" value="input" />
                  <el-option label="下拉框" value="select" />
                  <el-option label="日期" value="date" />
                  <el-option label="开关" value="switch" />
                </el-select>
                <el-switch v-model="item.required" active-text="必填" />
                <el-button link size="small" :disabled="index === 0" @click="moveFormItem(Number(index), -1)">上移</el-button>
                <el-button
                  link
                  size="small"
                  :disabled="index === node.config.items.length - 1"
                  @click="moveFormItem(Number(index), 1)"
                >
                  下移
                </el-button>
                <el-button type="danger" icon="Delete" circle size="small" @click="removeFormItem(Number(index))" />
              </div>
              <div class="card-row" style="margin-top: 6px">
                <el-input-number v-model="item.span" :min="1" :max="24" placeholder="span" controls-position="right" />
                <el-input v-model="item.width" placeholder="控件宽度 如 100% / 240px" />
              </div>
              <el-input
                v-if="item.component !== 'switch'"
                v-model="item.placeholder"
                placeholder="占位提示"
                style="margin-top: 6px"
              />
              <div v-if="item.component === 'select'" class="select-options">
                <div v-for="(opt, optIndex) in item.options || []" :key="optIndex" class="card-row">
                  <el-input v-model="opt.label" placeholder="显示文字" />
                  <el-input v-model="opt.value" placeholder="值" />
                  <el-button
                    type="danger"
                    icon="Delete"
                    circle
                    size="small"
                    @click="removeFormOption(item, Number(optIndex))"
                  />
                </div>
                <el-button type="primary" size="small" link @click="addFormOption(item)">添加选项</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 事件动作链 Tab (v1.3.0 L3) -->
        <el-tab-pane label="事件" name="events">
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
        </el-tab-pane>

        <!-- JSON 实时预览 Tab -->
        <el-tab-pane v-if="node.materialRef" label="物料" name="material">
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
        </el-tab-pane>

        <el-tab-pane label="JSON 源码" name="json">
          <SchemaJsonViewer />
        </el-tab-pane>

        <!-- 数据源置末（v2.3.0） -->
        <el-tab-pane label="数据源" name="api">
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
        </el-tab-pane>
      </el-tabs>
    </template>
    <div v-else class="no-selection">
      <el-empty description="请在画布中选中要配置的组件" />
    </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { parseExpression } from '../utils/expression';
import { ApiExecutor, nodeEventBus } from '../utils/dataSource';
import type { ActionType, ComponentNode, MaterialVersion } from '../types/designer';
import SchemaJsonViewer from './SchemaJsonViewer.vue';
import { missingRequiredFields } from '../registry/materialContract';
import { getOutputPayloadHints, validateComponentProps } from '../utils/contractValidator';
import { inlineableExpression } from '../utils/condition';
import { mergeApiBinding, moveListItem } from '../utils/apiBindingForm';
import { resolveMaterial } from '../utils/materialResolver';
import { http } from '../utils/http';
import { ElMessage } from 'element-plus';

const designerStore = useDesignerStore();

const flattenNodes = (nodes: ComponentNode[] | undefined, acc: Array<{ id: string; label: string }> = []) => {
  for (const item of nodes || []) {
    acc.push({ id: item.id, label: item.label || item.type });
    flattenNodes(item.children, acc);
  }
  return acc;
};

const targetNodes = computed(() => flattenNodes(designerStore.activeChildren));

const getExpressionPreview = (exprStr: string) => {
  try {
    return parseExpression(exprStr, designerStore.pageSchema.state || {});
  } catch (err: any) {
    return '求值出错: ' + err.message;
  }
};
const activeTab = ref('props');

const node = computed(() => designerStore.selectedNode);

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
const missingFields = computed(() => (node.value ? missingRequiredFields(node.value) : []));
/** 必填/类型 IO 警告（与 missingFields 互补；类型问题单独展示，必填去重） */
const propIoIssues = computed(() => {
  if (!node.value) return [];
  const missingNames = new Set(missingFields.value.map((f) => f.name));
  return validateComponentProps(node.value).filter((issue) => !missingNames.has(issue.name) || issue.message.includes('期望类型'));
});
const payloadHintMap = computed(() => {
  const type = node.value?.type;
  if (!type) return {} as Record<string, ReturnType<typeof getOutputPayloadHints>[number]>;
  return Object.fromEntries(getOutputPayloadHints(type).map((h) => [h.name, h]));
});
/** 原子物料事件区 payload 提示（无 materialRef 时也展示） */
const atomicOutputHints = computed(() => {
  if (!node.value || node.value.materialRef) return [];
  return getOutputPayloadHints(node.value.type).filter((h) => h.payloadSchema || h.samplePaths.length);
});

const formatEventPath = (path: string) => `{{ ${path} }}`;

const handleClose = () => {
  designerStore.closeInspector();
};

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

// ---------------------------------------------------------------------------
// 事件 Tab (L3)
// ---------------------------------------------------------------------------

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
const visibleWhenWarning = computed(() => {
  const raw = node.value?.visibleWhen?.trim();
  if (!raw) return '';
  return inlineableExpression(raw) ? '' : '显隐表达式无法安全求值，组件将保持显示';
});
const whenIsSafe = (when: string) => Boolean(inlineableExpression(when));

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

// ---------------------------------------------------------------------------
// 既有 Config Tab 操作
// ---------------------------------------------------------------------------

const addTableColumn = () => {
  if (node.value && node.value.config) {
    node.value.config.columns.push({
      prop: 'new_field_' + Date.now().toString(36).substring(4),
      label: '新字段列',
      width: '120',
      align: 'left'
    });
  }
};

const removeTableColumn = (index: number) => {
  if (node.value && node.value.config) {
    node.value.config.columns.splice(index, 1);
  }
};

const onFormComponentChange = (item: any) => {
  if (item.component === 'select' && !Array.isArray(item.options)) {
    item.options = [
      { label: '选项一', value: '1' },
      { label: '选项二', value: '2' }
    ];
  }
};

const addFormOption = (item: any) => {
  if (!Array.isArray(item.options)) item.options = [];
  item.options.push({ label: '新选项', value: 'value_' + item.options.length });
};

const removeFormOption = (item: any, index: number) => {
  item.options?.splice(index, 1);
};

const addFormItem = () => {
  if (node.value && node.value.config) {
    node.value.config.items.push({
      field: 'field_' + Date.now().toString(36).substring(4),
      label: '新表单项',
      component: 'input',
      placeholder: '请输入内容',
      span: 12
    });
  }
};

const removeFormItem = (index: number) => {
  if (node.value && node.value.config) {
    node.value.config.items.splice(index, 1);
  }
};

const moveTableColumn = (index: number, delta: number) => {
  if (node.value?.config?.columns) moveListItem(node.value.config.columns, index, delta);
};

const moveFormItem = (index: number, delta: number) => {
  if (node.value?.config?.items) moveListItem(node.value.config.items, index, delta);
};
</script>

<style scoped>
.inspector-pane {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  height: 100%;
  overflow: hidden;
}
.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.inspector-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}
.inspector-body {
  flex: 1;
  overflow: auto;
  padding: 8px 12px 16px;
}
.drawer-tabs {
  height: 100%;
}
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
.no-selection {
  padding-top: 40px;
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

<style>
.property-drawer.el-drawer {
  top: 72px;
  height: calc(100vh - 72px);
}
</style>
