import type { Linter } from 'eslint';
import globals from 'globals';

/**
 * 浏览器环境层：
 * 1. 注入 window/document/navigator 等浏览器全局变量；
 * 2. 可在此禁止 Node 专属 API 误入浏览器代码。
 */
export const browser = {
  languageOptions: {
    globals: {
      ...globals.browser,
    },
  },
  rules: {
    // 在这里添加浏览器环境专属规则
    // 禁止 Node 专属全局误入浏览器代码（环境互禁）
    'no-restricted-globals': [
      'error',
      { name: 'process', message: '浏览器代码禁止使用 Node 全局 process。' },
      { name: 'Buffer', message: '浏览器代码禁止使用 Node 全局 Buffer。' },
      { name: 'require', message: '浏览器代码禁止使用 Node 全局 require。' },
      { name: '__dirname', message: '浏览器代码禁止使用 Node 全局 __dirname。' },
      { name: 'global', message: '浏览器代码禁止使用 Node 全局 global。' },
      // 交互与导航类浏览器 API 统一封禁：
      // alert/confirm/prompt 是阻塞式隐式交互（应走显式 UI 组件）；
      // location/history 直接改写导航状态（应走路由层显式 API）
      { name: 'alert', message: '禁止使用 alert，请用显式 UI 组件与用户交互。' },
      { name: 'confirm', message: '禁止使用 confirm，请用显式 UI 组件与用户交互。' },
      { name: 'prompt', message: '禁止使用 prompt，请用显式 UI 组件与用户交互。' },
      { name: 'location', message: '禁止直接使用 location，请经路由层显式 API 导航。' },
      { name: 'history', message: '禁止直接使用 history，请经路由层显式 API 导航。' },
    ],
  },
} satisfies Linter.Config;
