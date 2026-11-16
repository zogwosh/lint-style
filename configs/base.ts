import type { Linter } from 'eslint';

import { lintstylePlugin } from './lintstyle-plugin';

/**
 * 环境无关的基础规则（手写白名单，不基于任何预设）。
 * 所有环境（浏览器 / Node）共用这一层。
 */
export const base = {
  plugins: {
    // 自定义规则（本层只用不需要类型信息的 no-silent-catch；
    // 需要类型信息的 boolean-only / no-dynamic-property-access 由 typed 层启用）
    lintstyle: lintstylePlugin,
  },
  rules: {
    // 在这里添加环境无关的基础规则
    // 禁用解构赋值（覆盖变量声明、赋值表达式、函数参数、catch 参数）
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ObjectPattern',
        message: '禁止对象解构赋值，请使用点号（obj.a）显式访问属性。',
      },
      {
        // 禁止数组解构赋值，请使用下标（arr[0]）显式访问元素。
        // 唯一豁免：SolidJS 响应式原语的元组解构（const [get, set] = createSignal(...)）——
        // eslint-plugin-solid 的 reactivity 规则要求以数组解构捕获
        // createSignal / createStore 的返回值才能做正确的响应式分析，
        // 两条规则在此直接冲突；响应用法优先，仅此场景放行。
        // 实现说明：主体节点必须是 VariableDeclarator（:not 无法跨节点回溯父级），
        // 链式单参 :not 做排除（esquery 的 :not 不接受多选择器参数）。
        selector:
          "VariableDeclarator[id=ArrayPattern]:not([init.callee.name='createSignal']):not([init.callee.name='createStore'])",
        message: '禁止数组解构赋值，请使用下标（arr[0]）显式访问元素。',
      },
      {
        // 函数参数位置的数组解构（与上条互补：声明位置已由 VariableDeclarator 主体覆盖）
        selector:
          ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > ArrayPattern',
        message: '禁止数组解构赋值，请使用下标（arr[0]）显式访问元素。',
      },
      {
        // 赋值与 for-of 位置的数组解构
        selector:
          ':matches(AssignmentExpression, ForOfStatement, ForInStatement) > ArrayPattern',
        message: '禁止数组解构赋值，请使用下标（arr[0]）显式访问元素。',
      },
      // 禁用三元表达式，改用 if/else 显式分支
      {
        selector: 'ConditionalExpression',
        message: '禁止使用三元表达式，请使用 if/else 显式分支。',
      },
      // 禁用 instanceof，改用类型守卫（x is T）或显式特征检查
      {
        selector: "BinaryExpression[operator='instanceof']",
        message: '禁止使用 instanceof，请使用类型守卫（x is T）或显式特征检查。',
      },
      // typeof 判断 'object' 不可靠：typeof null 也是 'object'，数组同样放行。
      // 判空用 x === null / x !== null，对象收窄用类型守卫（x is T）
      {
        selector:
          "BinaryExpression[operator=/===|!==/][left.type='UnaryExpression'][left.operator='typeof'][right.value='object']",
        message:
          '禁止用 typeof 判断 object（typeof null 也是 object），判空请用 x === null / x !== null，收窄请用类型守卫（x is T）。',
      },
      // 镜像写法：'object' === typeof x
      {
        selector:
          "BinaryExpression[operator=/===|!==/][right.type='UnaryExpression'][right.operator='typeof'][left.value='object']",
        message:
          '禁止用 typeof 判断 object（typeof null 也是 object），判空请用 x === null / x !== null，收窄请用类型守卫（x is T）。',
      },
      // typeof 判断 undefined 是 ES5 时代的防御式写法（防未声明变量）：
      // ESM/TS 下 x === undefined 对包括 unknown 在内的一切类型都成立，
      // 判空统一走显式 === / !==（白名单之外的写法封禁见 no-restricted-syntax 各条）
      {
        selector:
          "BinaryExpression[operator=/===|!==/][left.type='UnaryExpression'][left.operator='typeof'][right.value='undefined']",
        message: '禁止用 typeof 判断 undefined，请直接写 x === undefined。',
      },
      // 镜像写法：'undefined' === typeof x
      {
        selector:
          "BinaryExpression[operator=/===|!==/][right.type='UnaryExpression'][right.operator='typeof'][left.value='undefined']",
        message: '禁止用 typeof 判断 undefined，请直接写 x === undefined。',
      },
      // 禁用 for...in（会遍历原型链上的可枚举属性且键为 string），改用 Object.keys / Object.entries
      {
        selector: 'ForInStatement',
        message: '禁止使用 for...in，请使用 Object.keys() 或 Object.entries() 遍历对象。',
      },
      // 禁用类的继承（extends），改用组合而非继承
      {
        selector: 'ClassDeclaration[superClass]',
        message: '禁止使用类的继承（extends），请使用组合代替继承。',
      },
      {
        selector: 'ClassExpression[superClass]',
        message: '禁止使用类的继承（extends），请使用组合代替继承。',
      },
      // 禁止 super 引用（类继承已禁；super 仅在原型链委托场景有意义）
      {
        selector: 'Super',
        message: '禁止使用 super，其本质是沿原型链委托，请改用组合与显式函数调用。',
      },
      // 禁止对象字面量中的 __proto__ 键（no-proto 规则只覆盖 obj.__proto__ 成员访问）
      {
        selector: "Property[key.name='__proto__']",
        message: '禁止在对象字面量中使用 __proto__ 键，请改用普通属性组合。',
      },
      // 计算属性键变体：{ ['__proto__']: v }（绕过上面的标识符键匹配）
      {
        selector: "Property[computed=true][key.value='__proto__']",
        message: '禁止在对象字面量中使用 __proto__ 键，请改用普通属性组合。',
      },
      // 计算属性访问变体：obj['__proto__']（绕过 no-proto 的点号匹配）
      {
        selector: "MemberExpression[computed=true][property.value='__proto__']",
        message: '禁止通过计算属性访问 __proto__，请改用普通属性组合。',
      },
      // 禁止读取对象原型（Object.getPrototypeOf 沿链取原型）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='getPrototypeOf']",
        message: '禁止使用 Object.getPrototypeOf 读取原型，原型操作请改用组合或显式接口设计。',
      },
      // 禁止修改对象原型（Object.setPrototypeOf 是性能与正确性双重毒药）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='setPrototypeOf']",
        message: '禁止使用 Object.setPrototypeOf 修改原型，请改用组合或工厂函数。',
      },
      // 禁止 Object.create（以指定原型创建对象）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='create']",
        message: '禁止使用 Object.create，请使用对象字面量；无原型字典请改用 Map。',
      },
      // 禁止 Function.prototype 的 call / apply / bind（从 Function.prototype 借方法、
      // 显式改写 this 都依赖原型链；请直接调用或用箭头函数固定 this）。
      // Reflect.* 已由下方全家桶选择器统一封禁，此处 :not 排除避免同一节点双报
      {
        selector: "MemberExpression[property.name='call']:not([object.name='Reflect'])",
        message: '禁止使用 fn.call()，请直接调用函数或改用普通传参。',
      },
      {
        selector: "MemberExpression[property.name='apply']:not([object.name='Reflect'])",
        message: '禁止使用 fn.apply()，请使用展开运算符 fn(...args) 直接调用。',
      },
      {
        selector: "MemberExpression[property.name='bind']:not([object.name='Reflect'])",
        message: '禁止使用 fn.bind()，请使用箭头函数或包一层普通函数固定 this。',
      },
      // 计算属性访问变体：fn['call'] / fn['apply'] / fn['bind']（绕过上面的点号匹配）
      {
        selector: "MemberExpression[computed=true][property.value='call']:not([object.name='Reflect'])",
        message: "禁止使用 fn['call']()，请直接调用函数或改用普通传参。",
      },
      {
        selector: "MemberExpression[computed=true][property.value='apply']:not([object.name='Reflect'])",
        message: "禁止使用 fn['apply']()，请使用展开运算符 fn(...args) 直接调用。",
      },
      {
        selector: "MemberExpression[computed=true][property.value='bind']:not([object.name='Reflect'])",
        message: "禁止使用 fn['bind']()，请使用箭头函数或包一层普通函数固定 this。",
      },
      // 禁止嵌套 switch，内层逻辑提取为独立函数
      {
        selector: 'SwitchStatement SwitchStatement',
        message: '禁止嵌套 switch，请将内层 switch 提取为独立函数。',
      },
      // 禁止嵌套逻辑运算（&& / || / ! 组合或链式），拆成具名布尔变量或 if/else
      {
        selector: 'LogicalExpression LogicalExpression',
        message: '禁止嵌套逻辑运算（&& / || / !），请拆分为具名布尔变量或使用 if/else 显式分支。',
      },
      // ===== 动态性封禁（补充）：把决定推迟到运行时的写法 =====
      // 禁止 label + break/continue 的 goto 式跳转
      {
        selector: 'LabeledStatement',
        message: '禁止使用 label 跳转（goto 式控制流），请用函数拆分或 if/else 显式分支。',
      },
      // 禁止 delete（运行时改写对象形状），对象形状应恒定
      {
        selector: "UnaryExpression[operator='delete']",
        message: '禁止 delete 删除属性（运行时改写对象形状），请保持对象形状恒定或改用 Map。',
      },
      // 禁止运行时定义/重定义属性（可劫持 getter/setter，绕过所有静态检查）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='defineProperty']",
        message: '禁止 Object.defineProperty 运行时定义属性，请用普通属性或显式方法。',
      },
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='defineProperties']",
        message: '禁止 Object.defineProperties 运行时定义属性，请用普通属性或显式方法。',
      },
      // Reflect 全家桶：Reflect.setPrototypeOf / Reflect.apply / Reflect.construct /
      // Reflect.defineProperty / Reflect.deleteProperty ... 与上面已封的
      // Object.setPrototypeOf / fn.apply / Object.defineProperty 一一对应，
      // 只是换了名字的元编程统一入口，整族封禁（按对象名匹配，点号与计算访问全覆盖）
      {
        selector: "MemberExpression[object.name='Reflect']",
        message: '禁止使用 Reflect.*（与已封的原型/属性/调用类 API 一一对应的元编程后门），请用普通属性与直接调用。',
      },
      // Proxy：运行时劫持对象的一切读写/调用行为，绕过所有静态检查
      {
        selector: "NewExpression[callee.name='Proxy']",
        message: '禁止 new Proxy（运行时劫持对象行为），请改用显式包装函数。',
      },
      {
        selector: "CallExpression[callee.object.name='Proxy']",
        message: '禁止 Proxy.revocable（运行时劫持对象行为），请改用显式包装函数。',
      },
      // Object.assign：运行时给对象动态合并/扩形（与已封的 delete 同族，形状被运行时改写）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign']",
        message: '禁止 Object.assign 运行时合并/扩形对象，形状应在编译期确定（增量更新请逐字段显式赋值）。',
      },
      // 计算属性访问变体：Object['assign']（绕过上面的点号匹配）
      {
        selector: "CallExpression[callee.object.name='Object'][callee.property.value='assign']",
        message: '禁止 Object.assign 运行时合并/扩形对象，形状应在编译期确定（增量更新请逐字段显式赋值）。',
      },
      // obj.constructor：封了 __proto__ 和 getPrototypeOf 后通往原型链的最后一条近路
      {
        selector: "MemberExpression[property.name='constructor']",
        message: '禁止访问 obj.constructor（通往原型链的后门），类型判断请用类型守卫（x is T）。',
      },
      // 计算属性访问变体：obj['constructor']
      {
        selector: "MemberExpression[computed=true][property.value='constructor']",
        message: '禁止访问 obj.constructor（通往原型链的后门），类型判断请用类型守卫（x is T）。',
      },
      // 禁止访问 .prototype（读写内置/自定义原型 = 原型链污染入口，
      // 如 Array.prototype.map = ...、String.prototype.xxx）。
      // 组合模式下不应有任何触碰原型的理由；注意这也会拦下"只读"访问，
      // 若确需引用（极罕见），局部 eslint-disable 并注明理由
      {
        selector: "MemberExpression[property.name='prototype']",
        message: '禁止访问 .prototype（原型链污染入口），请用类语法或组合代替原型注入。',
      },
      // 计算属性访问变体：Foo['prototype']
      {
        selector: "MemberExpression[computed=true][property.value='prototype']",
        message: '禁止访问 .prototype（原型链污染入口），请用类语法或组合代替原型注入。',
      },
      // 禁止老式原型魔法（动态注入访问器）
      {
        selector: "MemberExpression[property.name='__defineGetter__']",
        message: '禁止 __defineGetter__ 原型魔法，请用普通属性或显式方法。',
      },
      {
        selector: "MemberExpression[property.name='__defineSetter__']",
        message: '禁止 __defineSetter__ 原型魔法，请用普通属性或显式方法。',
      },
      // 禁止已废弃的函数自省（能拿到调用链 = 行为动态化）
      {
        selector: "MemberExpression[property.name='caller']",
        message: '禁止 fn.caller 函数自省，调用关系应通过传参显式表达。',
      },
      // 禁止 arguments 对象自省（动态参数集合），
      // 用具名参数或剩余参数 (...rest) 显式声明。
      // :not 排除两类非 arguments 对象的引用：
      //   1) 属性键（对象字面量/接口/类成员的 `arguments:` 键名只是普通标识符）；
      //   2) 属性访问位置（如 AST 节点的 node.arguments）——注意 fn.arguments
      //      无法与合法属性访问在语法上区分，不再单独封禁：本项目全为
      //      ESM/TS（严格模式），运行时访问 fn.arguments 本就抛 TypeError
      {
        selector: "Identifier[name='arguments']:not(Property > Identifier, TSPropertySignature > Identifier, PropertyDefinition > Identifier, MethodDefinition > Identifier, MemberExpression > Identifier)",
        message: '禁止 arguments 对象自省，请用具名参数或剩余参数 (...rest) 显式声明。',
      },
      // in 沿原型链探测（与已禁的 instanceof 同族），改用 Object.hasOwn / Map.has
      {
        selector: "BinaryExpression[operator='in']",
        message: '禁止 in 操作符（沿原型链探测），自身属性用 Object.hasOwn()，集合用 Map.has() / includes()。',
      },
      // 全局 isNaN / isFinite 判断前会先做隐式 Number() 转换
      // （isNaN('12px') === false），数字判断必须走不做转换的
      // Number.isNaN / Number.isFinite。不用 no-restricted-globals 的原因：
      // browser / node 层各自重定义了该规则会整体覆盖 base 配置。
      // :not 排除成员访问位置（Number.isNaN）与属性键等普通标识符
      {
        selector:
          'Identifier[name=/^(isNaN|isFinite)$/]:not(MemberExpression > Identifier, Property > Identifier, TSPropertySignature > Identifier, MethodDefinition > Identifier, PropertyDefinition > Identifier)',
        message: '禁止使用全局 isNaN / isFinite（会先隐式 Number() 转换），请使用 Number.isNaN / Number.isFinite。',
      },
      // 动态正则是注入与 ReDoS 温床，强制正则字面量
      {
        selector: "NewExpression[callee.name='RegExp']",
        message: '禁止 new RegExp() 动态构造正则，请使用字面量 /…/ 写法（确需动态拼接时局部 eslint-disable 并注明理由）。',
      },
      // 禁止 getter/setter 访问器（对象字面量与类均覆盖，含 abstract）：
      // 调用像读属性、实际执行函数，是隐式执行的动态伪装
      {
        selector: "Property[kind='get'], Property[kind='set'], MethodDefinition[kind='get'], MethodDefinition[kind='set'], TSAbstractMethodDefinition[kind='get'], TSAbstractMethodDefinition[kind='set']",
        message: '禁止 getter/setter 访问器（像读属性一样隐式执行代码），状态用普通属性存，派生值用显式方法 getXxx() 表达。',
      },
      // 禁止默认导出（Go 包模型：标识符一律具名，导入方显式写名字，
      // 杜绝 import Xxx from ... 时名字随意取的问题）。
      // 要求默认导出的配置文件（如 eslint.config.ts）在项目内局部豁免
      {
        selector: 'ExportDefaultDeclaration',
        message: '禁止默认导出，请使用具名导出（导入方显式写名字）。',
      },
    ],
    // ===== 错误处理纪律（对应 Go "err 必须处理"）=====
    // 空 catch / 空 .catch(() => {}) / .then(ok, () => {}) 静默吞错一律拦截；
    // 未 await 的 Promise 由 typed 层 no-floating-promises 拦截，catch 参数
    // 声明未用由 no-unused-vars（caughtErrors: 'all'）拦截。
    // 显式忽略必须在块内写注释留痕说明理由
    'lintstyle/no-silent-catch': 'error',
    // 禁止空代码块（if / while / try 等空 {} 是被吞逻辑的藏身处）；
    // 含注释的块视为"显式留痕"放行。空 catch 与空 Promise 拒绝处理器
    // 由 lintstyle/no-silent-catch 统一拦截（报错信息更具体），此处豁免避免双报
    'no-empty': ['error', { allowEmptyCatch: true }],
    // 禁止宽松相等比较（== / != 会做隐式类型转换，改用 === / !==）
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    // 禁止隐式类型转换技巧（!!x、+x、'' + x、1 * x、~x 等），改用 Boolean() / Number() / String()
    'no-implicit-coercion': 'error',
    // 函数参数视为只读：禁止重新赋值参数，也禁止修改参数的属性
    // （如个别场景确需修改（如 reduce 累加器），在调用处局部 eslint-disable 或在此追加白名单）
    'no-param-reassign': ['error', { props: true }],
    // ===== 显式原型链封禁 =====
    // 禁止读写 __proto__（no-proto 只覆盖成员访问 obj.__proto__，
    // 对象字面量里的 __proto__ 键由 no-restricted-syntax 的选择器补齐）
    'no-proto': 'error',
    // 禁止直接调用 obj.hasOwnProperty()（原型方法，且对 null 原型对象会崩）
    'no-prototype-builtins': 'error',
    // Object.prototype.hasOwnProperty.call(...) 也要禁（显式借用原型方法），
    // 统一改用静态方法 Object.hasOwn()（不经过实例原型链）
    'prefer-object-has-own': 'error',
    // 禁止 eval / new Function：动态生成的代码里 this 语义完全脱离类型系统掌控
    //（new Function('return this')() 是经典的 this 逃逸口），且无法被任何静态规则追踪
    'no-eval': 'error',
    'no-new-func': 'error',
    // 禁止 debugger：忘删的调试断点会在运行时隐式挂起执行
    'no-debugger': 'error',
    // var 是函数作用域 + 变量提升 + 可重复声明，统一用 let/const（块级作用域）
    'no-var': 'error',
    // 能 const 就 const：引用一旦绑定不再漂移
    'prefer-const': 'error',
    // 只允许抛 Error 实例（throw '字符串' 丢失堆栈且无法分型捕获）
    'no-throw-literal': 'error',
    // 禁止 switch 穿透：忘写 break 会"穿"到下一个分支继续执行
    // （等价于编译器 noFallthroughCasesInSwitch，用 lint 层替代）
    'no-fallthrough': 'error',
    // 强制所有分支的返回行为一致：有的分支 return 值、有的分支漏掉 return，
    // 就会隐式返回 undefined（等价于编译器 noImplicitReturns，用 lint 层替代）
    'consistent-return': 'error',
    // 强制回调函数使用箭头函数：箭头函数没有自己的 this，词法锁定外层作用域，
    // 杜绝 items.map(function (item) { return this.prefix + item; }) 式的 this 遮蔽
    'prefer-arrow-callback': 'error',
    // 禁止逗号运算符（a = (1, b)）：隐式串行求值，每一步的结果被静默丢弃，
    // 拆成多条语句显式表达
    'no-sequences': 'error',
    // parseInt 必须显式给出进制（radix）：不带 radix 时依赖"默认十进制"的隐式行为
    'radix': 'error',
    // 禁止 new Object()：与对象字面量等价却多一层包装，且保留动态扩形的伪装入口
    'no-object-constructor': 'error',
    // 禁止 new String/Number/Boolean 包装器对象：生成的是对象不是原始值，
    // typeof 为 object、与原始值的 === 比较行为反直觉，类型转换一律用
    // String() / Number() / Boolean()（不带 new 的调用形式不受影响）
    'no-new-wrappers': 'error',
  },
} satisfies Linter.Config;
