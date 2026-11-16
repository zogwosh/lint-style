import type { Linter } from 'eslint';

/**
 * Tailwind CSS 可选层：检测过时的原子类（v3 → v4 更名 / 移除 / 废弃语法 / 不推荐用法），
 * 并在 JSX 层禁用行内元素（no-inline-elements，文本流统一 div 块级结构，a / label 豁免）。
 * 规则细节见 configs/rules/no-deprecated-tailwind.ts 与 configs/rules/no-inline-elements.ts。
 *
 * 不随 defineLintstyle 默认启用——只有使用 Tailwind 的项目才需要。
 * 消费项目在工厂结果之后追加导入：
 *   import { defineLintstyle, tailwind } from 'lintstyle';
 *   export default [...defineLintstyle({ env: 'browser' }), ...tailwind];
 *
 * 分两个文件块：jsx 解析开关只对真正含 JSX 语法的文件开启
 * （.ts / .js 上打开 jsx 解析会把泛型尖括号误读为 JSX 标签）。
 * 本层不注册解析器：ts 系文件由 typescript 层提供 tseslint 解析器，
 * js 系文件用默认 espree，此处只补 ecmaFeatures.jsx。
 */
export const tailwind: Linter.Config[] = [
  {
    files: ['**/*.{tsx,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'lintstyle/no-deprecated-tailwind': 'error',
      'lintstyle/no-inline-elements': 'error',
    },
  },
  {
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    rules: {
      'lintstyle/no-deprecated-tailwind': 'error',
    },
  },
];
