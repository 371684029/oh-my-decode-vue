<template>
  <el-dialog v-model="dialogVisible" title="零废码出码引擎 - 导出代码" width="800px" destroy-on-close>
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="Vue 3 SFC (.vue)" name="vue">
        <el-alert
          type="success"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="完整渲染"
          description="生成的 Vue 3 Composition API & TypeScript 单文件组件，渲染当前 Schema 描述的全部组件、图层与生命周期逻辑。"
        />
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
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block"><code v-html="highlight(vueCode, 'xml')"></code></pre>
      </el-tab-pane>

      <el-tab-pane label="Web Component (.js)" name="wc">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="完整渲染"
          description="需配套下载 PageTemplate.vue 置于同一目录，并在宿主项目（Vue 3 + Element Plus + Vite）中构建运行；React / Angular / jQuery / 原生 HTML 均可直接引用该自定义元素标签。"
        />
        <div class="code-header">
          <span class="code-desc">生成 W3C 标准跨框架 Web Component 自定义元素包装脚本：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(wcCode)">
              复制 JS 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(wcCode, 'custom-element.js')">
              下载 .js 文件
            </el-button>
            <el-button
              type="warning"
              size="small"
              icon="Download"
              @click="handleDownload(pageTemplateCode, 'PageTemplate.vue')"
            >
              下载配套 PageTemplate.vue
            </el-button>
          </div>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block"><code v-html="highlight(wcCode, 'javascript')"></code></pre>
      </el-tab-pane>

      <el-tab-pane label="独立 HTML (.html)" name="html">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="完整渲染"
          description="基于 Vue 3 CDN（完整版，含模板编译器）+ Element Plus CDN，模板完整内联，下载后双击即可在浏览器运行。"
        />
        <div class="code-header">
          <span class="code-desc">生成完整渲染的独立静态 HTML 包 (含 Element Plus CDN)：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(htmlCode)">
              复制 HTML 代码
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(htmlCode, 'index.html')">
              下载 .html 文件
            </el-button>
          </div>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block"><code v-html="highlight(htmlCode, 'xml')"></code></pre>
      </el-tab-pane>

      <el-tab-pane label="接口文档 (api.md)" name="api">
        <div class="code-header">
          <span class="code-desc">当前页面前端会请求的接口，含 Mock 响应示例：</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(apiDoc)">
              复制 Markdown
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(apiDoc, 'api.md')">
              下载 api.md
            </el-button>
          </div>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block"><code v-html="highlight(apiDoc, 'markdown')"></code></pre>
      </el-tab-pane>

      <el-tab-pane label="语料库 (corpus.jsonl)" name="corpus">
        <el-alert
          type="success"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="同一页两种组件"
          description="每条页面写成两行 JSONL：一行 Vue 单文件组件，一行独立 HTML。默认只收当前画布。"
        />
        <div class="code-header">
          <span class="code-desc">{{ corpusSummary }}</span>
          <div class="btn-group">
            <el-button type="primary" size="small" icon="DocumentCopy" @click="handleCopy(corpusText)">
              复制 JSONL
            </el-button>
            <el-button type="success" size="small" icon="Download" @click="handleDownload(corpusText, 'corpus.jsonl')">
              下载 corpus.jsonl
            </el-button>
          </div>
        </div>
        <el-checkbox v-model="includeSavedPages" style="margin-bottom: 12px">包含已保存的页面</el-checkbox>
        <pre class="code-block"><code>{{ corpusText }}</code></pre>
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
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block"><code v-html="highlight(pkgCode, 'json')"></code></pre>
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
import { ref, computed, watch } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import {
  generateVueSFC,
  generatePageTemplate,
  generateWebComponent,
  generateHTML,
  generatePackageJson
} from '../utils/codeGenerator';
import { renderApiMarkdown } from '../utils/frontendApi';
import { buildCorpus, renderCorpusJsonl } from '../utils/corpus';
import { API_BASE } from '../utils/http';
import type { PageSchema } from '../types/designer';
import { ElMessage } from 'element-plus';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

/** 代码语法高亮（hljs 会转义 HTML，返回内容安全，可 v-html） */
const highlight = (code: string, lang: string): string => {
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return code;
  }
};

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const designerStore = useDesignerStore();
const activeTab = ref('vue');
const includeSavedPages = ref(false);
const savedPages = ref<PageSchema[]>([]);

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
});

const loadSavedPages = async () => {
  try {
    const headers: Record<string, string> = { 'X-Operator': 'designer_user' };
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) headers['X-Api-Key'] = apiKey;
    const res = await fetch(`${API_BASE}/schemas?type=page`, { headers });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    savedPages.value = body?.success && Array.isArray(body.data) ? body.data : [];
  } catch {
    savedPages.value = [];
    ElMessage.warning('已保存页面没有读到，语料库仍包含当前画布');
  }
};

watch(includeSavedPages, (checked) => {
  if (checked) loadSavedPages();
  else savedPages.value = [];
});

const corpusEntries = computed(() =>
  buildCorpus(includeSavedPages.value ? [...savedPages.value, designerStore.pageSchema] : [designerStore.pageSchema])
);
const corpusText = computed(() => renderCorpusJsonl(corpusEntries.value));
const corpusSummary = computed(() => {
  const vueCount = corpusEntries.value.filter((entry) => entry.kind === 'vue').length;
  const htmlCount = corpusEntries.value.filter((entry) => entry.kind === 'html').length;
  return `${corpusEntries.value.length} 条语料：${vueCount} 个 Vue 组件，${htmlCount} 个 HTML 组件`;
});

const vueCode = computed(() => generateVueSFC(designerStore.pageSchema));
const pageTemplateCode = computed(() => generatePageTemplate(designerStore.pageSchema));
const wcCode = computed(() => generateWebComponent(designerStore.pageSchema));
const htmlCode = computed(() => generateHTML(designerStore.pageSchema));
const pkgCode = computed(() => generatePackageJson(designerStore.pageSchema));
const apiDoc = computed(() => renderApiMarkdown(designerStore.pageSchema));

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
