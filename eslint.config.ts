import { defineConfig } from 'eslint/config';

import { defineLintstyle } from './index';

/**
 * lintstyle 自身的 lint 配置：直接走 npm 分发的工厂入口（吃自己的狗粮），
 * 保证"发布的就是自用的"。工厂内部已包含：
 *   - 默认 ignores（node_modules / dist / coverage）
 *   - eslint.config.* 与各类 d.ts 声明文件的默认导出豁免（flat config 框架约束）
 * 项目特有的忽略目录通过 options.ignores 追加。
 */
export default defineConfig(...defineLintstyle({ env: 'node', typed: true }));
