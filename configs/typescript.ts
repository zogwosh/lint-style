import type { Plugin } from '@eslint/core';
import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/**
 * TypeScript 专属规则（不含类型信息，任何项目都能直接用）。
 * 需要类型感知的规则见 typed.ts。
 */
export const typescript: Linter.Config = {
  files: ['**/*.{ts,tsx,mts,cts}'],
  languageOptions: {
    // tseslint 的 Parser 类型基于旧版 @eslint/core，与 eslint v10 不完全兼容，需强制断言
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 三方类型互操作
    parser: tseslint.parser as unknown as NonNullable<Linter.Config['languageOptions']>['parser'],
  },
  plugins: {
    // tseslint 的插件类型与 eslint v10 不完全兼容，需强制断言
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 三方类型互操作
    '@typescript-eslint': tseslint.plugin as unknown as Plugin,
  },
  rules: {
    // 强制所有函数（含箭头函数）和类方法显式声明返回类型。
    // 例外：返回值用 as const 断言的箭头函数（字面量类型已明确），
    // 以及签名类型已显式标注的函数表达式（如 const f: () => void = () => {}，
    // 返回类型已在类型注解中显式声明，无需重复书写）。
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: false,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: false,
        allowDirectConstAssertionInArrowFunctions: true,
      },
    ],
    // 全面禁止类型断言（as T 和 <T> 尖括号两种写法都不允许）。
    // 类型收窄必须走可靠路径：类型守卫（x is T）、satisfies、Zod 等运行时校验，
    // 不允许靠 as 直接"信任开发者"绕过类型检查。
    // 注意：as const 是规则内置豁免（它只收紧字面量类型，不绕过类型检查），仍然可用。
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      { assertionStyle: 'never' },
    ],
    // 禁用显式 any。隐式 any 由 tsconfig 的 noImplicitAny（strict）接管；
    // any 从依赖类型等隐式路径的扩散由 typed 层的 no-unsafe-* 系列拦截。
    '@typescript-eslint/no-explicit-any': 'error',
    // 禁止未使用变量/参数（死代码与拼错的标识符会静默存活）；
    // 以 _ 开头表示有意保留，这是唯一豁免通道
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' },
    ],

    // ===== this 安全 =====
    // 禁止在非法上下文中使用 this（class 之外、无显式 this 参数的普通函数内部）。
    // 注意：基础版 no-invalid-this 不理解 TS 的 this 参数，不要在 base 层启用它。
    // 与 tsconfig 的 noImplicitThis（strict 自带）互补：编译器抓调用点，linter 抓书写点。
    '@typescript-eslint/no-invalid-this': 'error',
    // 禁止 this 别名（const self = this、const that = this 等规避手段），
    // this 引用必须保持显式；解构 this 的写法已被 base 层的 ObjectPattern 禁令覆盖
    '@typescript-eslint/no-this-alias': 'error',
    // 不使用 this 的类方法必须改为独立函数或 static（与本层"方法签名显式返回类型"和
    // base 层"禁 call/apply/bind"配套：不留"看似实例方法实则无状态"的灰色地带）。
    // 实现接口的方法和 override 方法豁免，避免生命周期钩子类误报
    '@typescript-eslint/class-methods-use-this': [
      'error',
      { ignoreOverrideMethods: true, ignoreClassesThatImplementAnInterface: true },
    ],
    // 禁用类型系统逃生注释：ts-ignore / ts-nocheck 彻底禁止；
    // 允许的 ts-expect-error 必须带说明文字（显式开闸要留痕，写明为什么类型对不上）
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true },
    ],
    // 禁止非空断言 x!（另一种"信任开发者"写法，与已禁的 as 同族）；
    // 可空性必须走显式判断
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    // 静态字符串键统一收编为点号访问 obj['x'] → obj.x：
    // 让"剩下的计算属性访问"都是真动态，交给 typed 层的自定义规则拦截。
    // 默认 allowIndexSignaturePropertyAccess: false 同时等价于编译器
    // noPropertyAccessFromIndexSignature：索引签名属性必须用方括号访问
    '@typescript-eslint/dot-notation': 'error',
    // 类型导入必须显式写 import type（等价于编译器 verbatimModuleSyntax 的
    // 显式性目标，用 lint 层替代）：导入意图明确，也让打包器无需猜测
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    // 禁止同名变量遮蔽（内外层同名时，读者以为在操作同一个变量）。
    // 解构已被 base 层禁掉，误报面很小；参数遮蔽同样拦截
    '@typescript-eslint/no-shadow': 'error',
  },
};
