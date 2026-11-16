import type { Linter } from 'eslint';

import { base } from './configs/base';
import { browser } from './configs/browser';
import { imports } from './configs/imports';
import { node } from './configs/node';
import { stylisticConfig } from './configs/stylistic';
import { tailwind } from './configs/tailwind';
import { createTyped } from './configs/typed';
import { typescript } from './configs/typescript';

/** defineLintstyle 的选项。 */
export interface LintstyleOptions {
  /**
   * 运行环境：注入对应全局变量，并互禁另一环境的 API
   * （Node 层禁 window/document 等，浏览器层禁 process/Buffer 等）。
   */
  env: 'node' | 'browser';
  /**
   * 是否启用类型感知规则层（strict-boolean-expressions、no-floating-promises、
   * lintstyle/boolean-only 等需要类型信息的规则）。默认 true。
   * 项目没有 tsconfig.json 时设为 false。
   */
  typed?: boolean;
  /**
   * 类型感知层的 tsconfig 根目录。默认 process.cwd()（ESLint 通常从项目根目录运行）。
   * monorepo 中 tsconfig 不在运行目录时，显式传入包含 tsconfig.json 的目录。
   */
  tsconfigRootDir?: string;
  /** 追加忽略的 glob。node_modules / dist / coverage 已默认忽略。 */
  ignores?: string[];
}

/**
 * lintstyle 配置工厂：消费项目 eslint.config.ts 的唯一入口。
 *
 * 按层拼装：ignores → base → typescript → typed? → stylistic → imports → env。
 * 内置一条通用豁免：eslint.config.* 需要 default export（flat config 框架约束，
 * base 层的默认导出禁令会误伤），d.ts 声明文件是三方类型契约——两者均关闭
 * no-restricted-syntax，其余文件不受影响。
 *
 * 用法（消费项目的 eslint.config.ts 全部内容）：
 *   import { defineLintstyle } from 'lintstyle';
 *   export default defineLintstyle({ env: 'node' });
 */
export function defineLintstyle(options: LintstyleOptions): Linter.Config[] {
  const env = options.env;
  const useTyped = options.typed ?? true;
  const tsconfigRootDir = options.tsconfigRootDir ?? process.cwd();
  const extraIgnores = options.ignores ?? [];

  const layers: Linter.Config[] = [
    {
      ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', ...extraIgnores],
    },
    base,
    typescript,
  ];

  if (useTyped) {
    layers.push(createTyped(tsconfigRootDir));
  }

  layers.push(stylisticConfig, imports);

  if (env === 'node') {
    layers.push(node);
  } else {
    layers.push(browser);
  }

  // 通用豁免：默认导出禁令只针对业务代码；配置文件与类型声明文件例外（见上方 JSDoc）
  layers.push({
    files: ['eslint.config.{ts,mts,js,mjs}', '**/*.d.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  });

  return layers;
}

/**
 * Tailwind 可选层：检测过时的原子类（v3 → v4 更名 / 移除 / 废弃语法 / 不推荐用法），
 * 并在 JSX 层禁用行内元素（a / label 豁免）。
 *
 * 不随 defineLintstyle 默认启用；使用 Tailwind 的项目自行追加：
 *   export default [...defineLintstyle({ env: 'browser' }), ...tailwind];
 */
export { tailwind };
