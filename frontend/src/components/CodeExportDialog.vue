<template>
  <el-dialog
    v-model="dialogVisible"
    title="零废码出码引擎 - 导出代码"
    width="800px"
    destroy-on-close
  >
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="Vue 3 SFC (.vue)" name="vue">
        <div class="code-header">
          <span class="code-desc">生成符合企级规范的 Vue 3 Composition API & TypeScript 单文件组件代码：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(vueCode)">
              复制 Vue 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(vueCode, 'Page.vue')">
              下载 .vue 文件
            </el-button>
          </div>
        </div>
        <pre class="code-block"><code>{{ vueCode }}</code></pre>
      </el-tab-pane>

      <el-tab-pane label="Web Component (.js)" name="wc">
        <div class="code-header">
          <span class="code-desc">生成基于 W3C 标准的跨框架 Web Component 原生自定义元素：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(wcCode)">
              复制 JS 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(wcCode, 'custom-element.js')">
              下载 .js 文件
            </el-button>
          </div>
        </div>
        <pre class="code-block"><code>{{ wcCode }}</code></pre>
      </el-tab-pane>

      <el-tab-pane label="独立 HTML (.html)" name="html">
        <div class="code-header">
          <span class="code-desc">生成可直接在浏览器双击打开运行的独立静态 HTML 包 (含 Element Plus CDN)：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(htmlCode)">
              复制 HTML 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(htmlCode, 'index.html')">
              下载 .html 文件
            </el-button>
          </div>
        </div>
        <pre class="code-block"><code>{{ htmlCode }}</code></pre>
      </el-tab-pane>

      <el-tab-pane label="package.json 清单" name="pkg">
        <div class="code-header">
          <span class="code-desc">自动提取当前低代码页面所依赖的项目构建 package.json：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(pkgCode)">
              复制 JSON 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(pkgCode, 'package.json')">
              下载 package.json
            </el-button>
          </div>
        </div>
        <pre class="code-block"><code>{{ pkgCode }}</code></pre>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { generateVueSFC, generateWebComponent, generateHTML, generatePackageJson } from '../utils/codeGenerator';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const designerStore = useDesignerStore();
const activeTab = ref('vue');

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
});

const vueCode = computed(() => generateVueSFC(designerStore.pageSchema));
const wcCode = computed(() => generateWebComponent(designerStore.pageSchema));
const htmlCode = computed(() => generateHTML(designerStore.pageSchema));
const pkgCode = computed(() => generatePackageJson(designerStore.pageSchema));

const handleCopy = (text: string) => {
  navigator.clipboard.writeText(text);
  ElMessage.success('代码已成功复制到剪贴板！');
};

const handleDownload = (text: string, filename: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  ElMessage.success(`已开始下载文件: ${filename}`);
};
</script>

<style scoped>
.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.code-desc {
  font-size: 13px;
  color: #606266;
}
.btn-group {
  display: flex;
  gap: 8px;
}
.code-block {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 6px;
  max-height: 420px;
  overflow: auto;
  font-family: 'Fira Code', Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
</style>
