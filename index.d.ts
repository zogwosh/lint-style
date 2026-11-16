import type { Linter } from 'eslint';

export interface LintstyleOptions {
  /**
   * 运行环境：注入对应全局变量，并互禁另一环境的 API。
   */
  env: 'node' | 'browser';
  /**
   * 是否启用类型感知规则层（需要项目里有 tsconfig.json）。默认 true。
   */
  typed?: boolean;
  /**
   * 类型感知层的 tsconfig 根目录。默认 process.cwd()。
   */
  tsconfigRootDir?: string;
  /**
   * 追加忽略的 glob（node_modules / dist / coverage 已默认忽略）。
   */
  ignores?: string[];
}

/**
 * lintstyle 配置工厂：消费项目 eslint.config.ts 的唯一入口。
 */
export declare function defineLintstyle(options: LintstyleOptions): Linter.Config[];

/**
 * Tailwind 可选层：检测过时的原子类（v3 → v4 更名 / 移除 / 废弃语法 / 不推荐用法），
 * 并在 JSX 层禁用行内元素（a / label 豁免）。
 * 不随 defineLintstyle 默认启用；使用 Tailwind 的项目自行追加：
 *   export default [...defineLintstyle({ env: 'browser' }), ...tailwind];
 */
export declare const tailwind: Linter.Config[];
