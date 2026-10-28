import { createApp } from 'vue';
import { createPinia } from 'pinia';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';

// 全量主题：函数式 ElMessage/MessageBox 依赖 CSS 变量，按需解析器不会注入
import 'element-plus/dist/index.css';
import './designer.css';

const app = createApp(App);

// 全局注册 Element Plus 图标（物料库以字符串名动态渲染图标）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.mount('#app');
