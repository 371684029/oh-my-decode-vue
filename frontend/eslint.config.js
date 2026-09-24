import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/auto-imports.d.ts', 'src/components.d.ts', 'src/env.d.ts']
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module'
      }
    },
    rules: {
      // 项目契约：允许显式 any（逐步收紧）
      '@typescript-eslint/no-explicit-any': 'off',
      // Vue 单文件组件允许单字组件名（App.vue 等入口）
      'vue/multi-word-component-names': 'off',
      // 未使用变量仅警告
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // 允许 console 调试（原型阶段）
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  // 关闭与 Prettier 冲突的格式规则（格式交由 Prettier 负责）
  eslintConfigPrettier
);
