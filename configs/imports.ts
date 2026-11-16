import type { Linter } from 'eslint';
import importX from 'eslint-plugin-import-x';

/**
 * 模块依赖层：包纪律（Go 包模型的对应物）。
 *
 * - import 循环在 Go 里是编译错误；这里用 import-x/no-cycle 在 lint 层等价拦截
 *   （选 import-x 而非 eslint-plugin-import：同一套规则，依赖更轻、维护更活跃）；
 * - 默认导出禁令在 base 层（no-restricted-syntax: ExportDefaultDeclaration）。
 */
export const imports = {
  plugins: {
    'import-x': importX,
  },
  settings: {
    // 用 TS 解析器解析模块路径（TS 文件的相对导入不带扩展名，默认
    // node 解析器解析不到，循环检测会静默漏报）
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    // 必须显式补上 TS 扩展名：import-x 默认只认 .js/.mjs/.cjs，
    // 缺了这条 no-cycle 会对 .ts 依赖静默跳过（视为不可达，循环漏报）
    'import-x/extensions': ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
  },
  rules: {
    // 禁止 import 循环依赖（含动态 import() 构成的环，
    // allowUnsafeDynamicCyclicDependency 默认即 false）
    'import-x/no-cycle': 'error',
  },
} satisfies Linter.Config;
