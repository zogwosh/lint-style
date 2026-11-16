import type { Linter } from 'eslint';
import globals from 'globals';
import nodePlugin from 'eslint-plugin-n';

/**
 * Node 环境层：
 * 1. 注入 process/Buffer/__dirname 等 Node 全局变量；
 * 2. 可在此禁止浏览器专属 API 误入 Node 代码；
 * 3. eslint-plugin-n 提供Node 场景专属规则（如 n/no-process-exit）。
 */
export const node = {
  languageOptions: {
    globals: {
      ...globals.node,
    },
  },
  plugins: {
    n: nodePlugin,
  },
  rules: {
    // 在这里添加 Node 环境专属规则
    // 禁止浏览器专属全局误入 Node 代码（环境互禁）
    'no-restricted-globals': [
      'error',
      { name: 'window', message: 'Node 代码禁止使用浏览器全局 window。' },
      { name: 'document', message: 'Node 代码禁止使用浏览器全局 document。' },
      { name: 'navigator', message: 'Node 代码禁止使用浏览器全局 navigator。' },
      { name: 'localStorage', message: 'Node 代码禁止使用浏览器全局 localStorage。' },
      { name: 'sessionStorage', message: 'Node 代码禁止使用浏览器全局 sessionStorage。' },
      { name: 'alert', message: 'Node 代码禁止使用浏览器全局 alert。' },
    ],
  },
} satisfies Linter.Config;
