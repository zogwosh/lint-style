import type { Linter } from 'eslint';

import { lintstylePlugin } from './lintstyle-plugin';

/**
 * 类型感知规则层工厂（需要项目里有 tsconfig.json）。
 * 只在具备 tsconfig 的项目中启用，其他项目可跳过这一层。
 *
 * tsconfigRootDir 必须由调用方传入：本包发布到 npm 后位于
 * node_modules/lintstyle/configs/ 下，无法用 import.meta.dirname
 * 自行推断出消费项目的根目录。工厂入口（index.ts）默认传 process.cwd()，
 * monorepo 等特殊场景可显式指定。
 */
export const createTyped = (tsconfigRootDir: string): Linter.Config => ({
  languageOptions: {
    parserOptions: {
      // 用 tsconfig 的 project 服务做类型解析
      projectService: true,
      tsconfigRootDir,
    },
  },
  plugins: {
    // 本项目自定义规则（类型感知规则 boolean-only / no-dynamic-property-access；
    // 与 base 层共用 lintstyle-plugin.ts 的同一插件实例，避免同名插件互相覆盖）
    lintstyle: lintstylePlugin,
  },
  rules: {
    // 需要类型信息的规则
    // 注意：8.72.x 下这些规则必须显式传选项，裸写 'error' 会静默不生效
    // 拦截 + 两侧类型不一致（如 'a' + 1、number + string）
    '@typescript-eslint/restrict-plus-operands': [
      'error',
      { allowAny: false, allowNullish: false, allowNumberAndString: false, allowRegExp: true, allowBoolean: false },
    ],
    // 非布尔值不能直接做条件判断（if (str)、if (num) 等）
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowAny: false,
        allowNullableBoolean: false,
        allowNullableObject: false,
        allowNullableNumber: false,
        allowNullableString: false,
        allowNumber: false,
        allowString: false,
        allowNullableEnum: false,
      },
    ],
    // 拦截恒真/恒假的冗余判断（如 if (alwaysTruthyString)）
    '@typescript-eslint/no-unnecessary-condition': 'error',
    // 覆盖 base 层同名规则：!!x 的判定由 strict-boolean-expressions 接管（类型感知更准），
    // 避免 !!str 被两条规则双重报错；其余转换技巧（+x、'' + x 等）仍由 base 层拦截
    'no-implicit-coercion': ['error', { allow: ['!!'] }],
    // 禁止 any 从依赖类型等隐式路径扩散进来（显式 any 由 typescript 层的 no-explicit-any 拦截）
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    // 逻辑非（!）操作数只接受布尔值：strict-boolean-expressions 覆盖不到的
    // 最后一个真假转换位置（if/&&/|| 已由其管制，?? 是显式判空合并、
    // switch 是严格相等匹配，均无真假转换，不在此列）
    'lintstyle/boolean-only': 'error',
    // 禁止以未绑定方式引用依赖 this 的类方法（const f = obj.method、arr.forEach(obj.method)、
    // setTimeout(obj.tick) 等传递中丢失 this 的场景）。对象解构已被 base 层禁掉，
    // 这条补齐"方法别名"和"方法作为回调传参"两个漏网之鱼。
    // 需要类型信息（typed-linting），故放在 typed 层
    '@typescript-eslint/unbound-method': 'error',
    // 禁止动态属性访问 obj[expr] 与对象动态键 { [expr]: v }：
    // 数组/元组下标放行，其余对象形状必须在编译期确定（键值集合用 Map）。
    // 与 typescript 层的 dot-notation 配合：静态字符串键先被收编为点号访问，
    // 剩下的计算访问都是真动态，由本规则统一拦截
    'lintstyle/no-dynamic-property-access': 'error',
    // 调用 Promise 返回值的函数却不 await = 结果与错误被静默丢弃
    //（与 Go "必须处理 err" 的哲学对立）。ignoreVoid: false 连 void p() 的
    // 遮羞布写法也一并拦截；ignoreIIFE: false 顶层异步初始化同样不许漏 await
    '@typescript-eslint/no-floating-promises': [
      'error',
      { ignoreVoid: false, ignoreIIFE: false },
    ],
    // 模板字符串 ${x} 是隐式 toString 的后门（restrict-plus-operands 拦住了
    // 'a' + 1，这里补齐同一类转换的另一种写法）。一切转字符串必须显式 String()
    '@typescript-eslint/restrict-template-expressions': [
      'error',
      {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumber: false,
        allowRegExp: false,
      },
    ],
    // switch 必须穷尽联合类型的所有分支（Go 式穷尽 switch）；
    // 默认不强制写 default（列全了就不需要兜底）
    '@typescript-eslint/switch-exhaustiveness-check': [
      'error',
      { allowDefaultCaseForExhaustiveSwitch: true, requireDefaultForNonUnion: false },
    ],
    // 禁止 Promise 放错位置：Promise 对象本身恒为 truthy（当条件用 = 恒真），
    // forEach/Map 等期望 void 的回调收 async 函数 = 结果与异常被静默丢弃
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksConditionals: true,
        checksVoidReturn: {
          arguments: true,
          attributes: true,
          inheritedMethods: true,
          properties: true,
          returns: true,
          variables: true,
        },
        checksSpreads: true,
      },
    ],
    // 禁止 await 非 Promise 值（await-thenable）：await 一个 number/string
    // 与没 await 无异，多半是笔误或设计错误
    '@typescript-eslint/await-thenable': 'error',
    // async 函数体内必须有 await（require-await）：没有 await 的 async
    // 是"假异步"，直接返回值或普通函数更诚实
    '@typescript-eslint/require-await': 'error',
    // 禁止隐式 eval 变体：setTimeout('code()') / setInterval('code()') /
    // execScript 的字符串参数会在运行时被当代码执行，no-eval 管不到这里
    '@typescript-eslint/no-implied-eval': 'error',
    // 判空意图必须显式：左侧可能为 null/undefined 时，|| 的语义（连 0/'' 一起吞）
    // 和 ?? （只判空）不同，要求统一写 ?? 表达"只补空值"
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    // 禁止对没有自定义 toString 的对象做字符串转换（结果只会是 "[object Object]"，
    // 纯隐式行为）：String(obj) / `a${obj}b` / '' + obj 均拦截。
    // checkUnknown: true 让 unknown 类型同样报错（显式收窄后再转）
    '@typescript-eslint/no-base-to-string': [
      'error',
      { checkUnknown: true },
    ],
  },
} satisfies Linter.Config);
