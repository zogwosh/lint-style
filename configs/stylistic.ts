import type { Linter } from 'eslint';
import stylistic from '@stylistic/eslint-plugin';

/**
 * 代码风格层（用 @stylistic 承接，ESLint 核心的格式化规则已废弃）。
 */
export const stylisticConfig = {
  plugins: {
    '@stylistic': stylistic,
  },
  rules: {
    // 分号强制补全（语句结尾必须有分号）
    '@stylistic/semi': ['error', 'always'],
    // 字符串统一单引号；含单引号的字符串允许用双引号包裹，避免转义噪音
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
    // 缩进统一 2 空格（不混用 Tab）
    '@stylistic/indent': ['error', 2],
    // 多行结构尾逗号必须写（单行不加）：增删项与改行时 diff 干净
    '@stylistic/comma-dangle': ['error', 'always-multiline'],
  },
} satisfies Linter.Config;
