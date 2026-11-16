import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * 自定义规则：检测过时的 Tailwind 原子类（v3 → v4 破坏性变更）。
 *
 * 依据 Tailwind v4 官方升级指南（tailwindcss.com/docs/upgrade-guide）拦截四类问题：
 *   1. 更名：shadow-sm → shadow-xs、rounded → rounded-sm、outline-none → outline-hidden、
 *      ring → ring-3、flex-grow → grow、bg-gradient-to-* → bg-linear-to-* 等；
 *      存在一对一替换，提供 autofix（token 级原位替换，保留变体前缀）；
 *   2. 移除：bg-opacity-* / text-opacity-* 等透明度工具类 → 改用透明度修饰符
 *      （如 bg-black/50），目标颜色无法机械推断，只报错给出建议；
 *   3. 废弃语法：important 修饰符前缀（!flex → flex!）、任意值中的 CSS 变量
 *      简写（bg-[--x] → bg-(--x)），均可 autofix；
 *   4. 不推荐用法 / 行为陷阱（官方建议迁移，无机械替换，只报错）：
 *      space-x/y-*（含负值变体 -space-x-*，子元素 margin hack，官方建议 flex/grid + gap）、
 *      divide-x/y-*（同样含负值变体，建议 gap + 逐元素边框）、
 *      shadow-inner（v4 已移除，改用 inset-shadow-*）、
 *      裸 transform / filter / backdrop-filter（v3 启用开关；v4 源码仍保留向后兼容但已无必要）、
 *      float / clear-*（布局已被 flex/grid 取代，float 仅剩文本绕排用途）、
 *      CSS 表格显示家族（table / table-cell 等，布局 hack 应改 flex/grid）、
 *      h-screen / w-screen 系列（100vh/100vw 有移动端动态视口问题，改 h-dvh 等；含 h-[100vh] 等任意值字面写法）、
 *      container（v4 移除 center/padding 配置，定制需改用 @utility 指令）、
 *      inline / inline-block（行内布局整体禁用，行内容器改 inline-flex；元素级禁令见 no-inline-elements）、
 *      transform-none（v4 不再重置 rotate/scale/translate，需单独属性重置）、
 *      grid-cols/rows/object 任意值中的逗号（v3"逗号=空格"兼容已移除，可 autofix 为下划线）。
 *   5. 跨 token 上下文检查（同一宿主字符串内判断，report-only）：
 *      bare border 无同串边框颜色（v4 默认色 gray-200 → currentColor）、
 *      ring / ring-3 无同串 ring 颜色（v4 默认色 blue-500 → currentColor）、
 *      bare outline 与 outline-<number> 并存（v4 中后者自带 solid，前者冗余）。
 *      只在单个宿主字符串内判定，cn('border', hasColor && 'border-gray-200') 这类跨参数场景会漏报，接受。
 *
 * 扫描范围（只碰"确定是类名"的字符串，避免普通字符串误报）：
 *   - JSX 的 className / class 属性（字符串字面量与模板字符串的静态段）；
 *   - cn / clsx / tw / twMerge / cva 调用参数中的字符串字面量与模板字符串静态段。
 *
 * 匹配前先剥离变体前缀（hover: / md: / [&>img]: 等取最后一段），
 * 方括号任意值（shadow-[...]）不参与更名匹配；修复会原样保留变体前缀。
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/lintstyle/lintstyle/blob/main/docs/rules/${name}.md`,
);

/** v4 更名的原子类（精确匹配：旧名 → 新名），全部可自动替换。 */
const RENAMED_CLASSES: ReadonlyMap<string, string> = new Map<string, string>([
  ['shadow-sm', 'shadow-xs'],
  ['shadow', 'shadow-sm'],
  ['drop-shadow-sm', 'drop-shadow-xs'],
  ['drop-shadow', 'drop-shadow-sm'],
  ['blur-sm', 'blur-xs'],
  ['blur', 'blur-sm'],
  ['backdrop-blur-sm', 'backdrop-blur-xs'],
  ['backdrop-blur', 'backdrop-blur-sm'],
  ['rounded-sm', 'rounded-xs'],
  ['rounded', 'rounded-sm'],
  ['outline-none', 'outline-hidden'],
  ['ring', 'ring-3'],
  ['overflow-ellipsis', 'text-ellipsis'],
  ['decoration-slice', 'box-decoration-slice'],
  ['decoration-clone', 'box-decoration-clone'],
]);

/** 前缀式更名（按顺序尝试：靠前的优先，保证 bg-gradient-to- 先于 bg-gradient- 命中）。 */
interface PrefixRename {
  prefix: string;
  replacement: string;
}

const RENAMED_PREFIXES: readonly PrefixRename[] = [
  { prefix: 'flex-shrink', replacement: 'shrink' },
  { prefix: 'flex-grow', replacement: 'grow' },
  { prefix: 'bg-gradient-to-', replacement: 'bg-linear-to-' },
  { prefix: 'bg-gradient-', replacement: 'bg-' },
];

/** v4 已移除的透明度工具类前缀：新写法依赖具体颜色，无法机械替换，只报错。 */
const REMOVED_OPACITY_PREFIXES: readonly string[] = [
  'bg-opacity-',
  'text-opacity-',
  'border-opacity-',
  'divide-opacity-',
  'ring-opacity-',
  'placeholder-opacity-',
];

/** 任意值中 v3 的 CSS 变量简写（[--x]），v4 要求改用圆括号 ((--x))。 */
const VARIABLE_SHORTHAND_PATTERN = /\[--[^\]]+\]$/;

/** "逗号=空格"兼容已移除的工具类前缀：任意值中的逗号在 v4 表示字面逗号，须改下划线。 */
const COMMA_ARBITRARY_PREFIXES: readonly string[] = ['grid-cols-', 'grid-rows-', 'object-'];

/** CSS 表格显示布局家族（精确匹配；table-auto / table-fixed 是表格布局算法工具，不受影响）。 */
const TABLE_DISPLAY_CLASSES: readonly string[] = [
  'table',
  'inline-table',
  'table-row',
  'table-row-group',
  'table-header-group',
  'table-footer-group',
  'table-column',
  'table-column-group',
  'table-cell',
  'table-caption',
];

/** 100vh/100vw 视口工具（h-screen / w-screen 及 min-/max- 前缀变体）。 */
const VIEWPORT_FALLBACK_PATTERN = /^(?:min-|max-)?[wh]-screen$/;

/** 任意值里的字面 100vh/100vw（calc() 等复杂任意值不匹配，避免误报）。 */
const VIEWPORT_ARBITRARY_PATTERN = /^(?:min-|max-)?[wh]-\[100v[wh]\]$/;

/** 除 JSX className 外，额外扫描的类名工具函数名（只匹配标识符调用）。 */
const UTILITY_FUNCTIONS: readonly string[] = ['cn', 'clsx', 'tw', 'twMerge', 'cva', 'classnames', 'cx'];

/** 跨 token 上下文：同一宿主字符串内是否已有边框颜色 / ring 颜色 / outline 宽度。 */
interface ScanContext {
  hasBorderColor: boolean;
  hasRingColor: boolean;
  hasOutlineWidth: boolean;
}

/**
 * 边框颜色 token 判定（排除法）：宽度（border-0/2/...、border-x/y/t/b/l/r/s/e[-n]）、
 * 样式（solid/dashed/...）、逻辑（collapse/separate/spacing）与任意值不算颜色；宁可漏报不误判。
 */
const isBorderColorToken = (core: string): boolean => {
  if (!core.startsWith('border-')) {
    return false;
  }
  // 任意值（如 border-[2px]）宽度/颜色语义不明，不作为颜色上下文，宁可漏报
  if (core.includes('[')) {
    return false;
  }
  const nonColor = /^border-(?:0|[1-9]\d*|(?:x|y|t|b|l|r|s|e)(?:-\d+)?|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing(?:-[xy])?(?:-\d+)?)$/;
  return !nonColor.test(core);
};

/** ring 颜色 token 判定：宽度（ring-0/1/3/...）、offset-*（含 offset 颜色，不等于 ring 颜色）与 inset 不算。 */
const isRingColorToken = (core: string): boolean => {
  if (!core.startsWith('ring-')) {
    return false;
  }
  if (core.includes('[')) {
    return false;
  }
  const nonColor = /^ring-(?:0|[1-9]\d*|offset-\S+|inset)$/;
  return !nonColor.test(core);
};

/** 从单个 token 提取判定用 core：剥变体前缀、important 前缀与负号。 */
const toUnsignedCore = (token: string): string => {
  const lastColonIndex = token.lastIndexOf(':');
  let core = token.slice(lastColonIndex + 1);
  if (core.startsWith('!')) {
    core = core.slice(1);
  }
  if (core.startsWith('-')) {
    return core.slice(1);
  }
  return core;
};

/** 第一遍扫描：根据全部 token 建立跨 token 上下文。 */
const buildScanContext = (tokens: readonly string[]): ScanContext => {
  const context: ScanContext = { hasBorderColor: false, hasRingColor: false, hasOutlineWidth: false };
  for (const token of tokens) {
    const core = toUnsignedCore(token);
    if (isBorderColorToken(core)) {
      context.hasBorderColor = true;
    }
    if (isRingColorToken(core)) {
      context.hasRingColor = true;
    }
    if (/^outline-\d+$/.test(core)) {
      context.hasOutlineWidth = true;
    }
  }
  return context;
};

interface TokenFinding {
  messageId: 'renamedClass' | 'removedOpacity' | 'importantPosition' | 'variableShorthand' | 'discouragedPattern' | 'missingDefaultColor' | 'redundantOutline';
  data: { old: string; new: string };
  /** 整个 token（含变体前缀）替换后的完整写法；null 表示无法机械替换。 */
  fixToken: string | null;
}

interface TokenRange {
  finding: TokenFinding;
  /** token 在宿主字符串内的起始偏移。 */
  start: number;
  /** token 在宿主字符串内的结束偏移（不含）。 */
  end: number;
}

/** 解析单个 token：先剥变体前缀与 important 前缀，再按 更名 → 移除 → 废弃语法 依次判定。 */
const resolveToken = (token: string): TokenFinding | null => {
  const lastColonIndex = token.lastIndexOf(':');
  let variants = '';
  if (lastColonIndex !== -1) {
    variants = token.slice(0, lastColonIndex + 1);
  }
  const base = token.slice(lastColonIndex + 1);

  // v3 的 important 修饰符写在类名开头（!flex），v4 要求挪到末尾（flex!）
  let core = base;
  let hasImportantPrefix = false;
  if (core.startsWith('!')) {
    hasImportantPrefix = true;
    core = core.slice(1);
  }
  let importantSuffix = '';
  if (hasImportantPrefix) {
    importantSuffix = '!';
  }

  const renamed = RENAMED_CLASSES.get(core);
  if (renamed !== undefined) {
    const fixToken = variants + renamed + importantSuffix;
    return { messageId: 'renamedClass', data: { old: token, new: fixToken }, fixToken };
  }

  for (const rename of RENAMED_PREFIXES) {
    if (core.startsWith(rename.prefix)) {
      const fixToken = variants + rename.replacement + core.slice(rename.prefix.length) + importantSuffix;
      return { messageId: 'renamedClass', data: { old: token, new: fixToken }, fixToken };
    }
  }

  for (const prefix of REMOVED_OPACITY_PREFIXES) {
    if (core.startsWith(prefix)) {
      return { messageId: 'removedOpacity', data: { old: token, new: '' }, fixToken: null };
    }
  }

  // ===== 不推荐用法 / 行为陷阱（官方建议迁移，无机械替换，只报错）=====
  // 负值变体：-space-x-4 / -divide-y-2 与正值同源（去负号后判定），一并拦截
  let unsignedCore = core;
  if (unsignedCore.startsWith('-')) {
    unsignedCore = unsignedCore.slice(1);
  }
  // space-x/y-*：子元素 margin hack，v4 选择器已变更，官方建议 flex/grid + gap
  if (unsignedCore.startsWith('space-x') || unsignedCore.startsWith('space-y')) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: '请迁移到 flex/grid 布局并使用 gap-* 间距（官方推荐）' },
      fixToken: null,
    };
  }
  // divide-x/y-*：同样是子选择器实现（v4 已变更），官方建议 gap + 逐元素边框
  if (unsignedCore.startsWith('divide-x') || unsignedCore.startsWith('divide-y')) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: '请改用 gap-* 搭配逐元素边框（divide 的子选择器实现已在 v4 变更）' },
      fixToken: null,
    };
  }
  // shadow-inner：v4 已移除，替代系列 inset-shadow-* 数值不完全对应
  if (unsignedCore === 'shadow-inner') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'v4 已移除 shadow-inner，请改用 inset-shadow-* 系列（数值不完全对应，需目测核对效果）' },
      fixToken: null,
    };
  }
  // 裸 transform：v3 用于启用变换组合，v4 的 rotate/scale/translate 独立生效，不再需要
  if (unsignedCore === 'transform') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'v3 的裸 transform 用于启用变换组合；v4 中 rotate/scale/translate 独立生效，该类不再需要，直接删除即可' },
      fixToken: null,
    };
  }
  // 裸 filter / backdrop-filter：v3 的滤镜启用开关（v4 源码仍保留向后兼容，但已无必要）
  if (unsignedCore === 'filter' || unsignedCore === 'backdrop-filter') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'v3 的裸 filter / backdrop-filter 用于启用滤镜组合；v4 中各滤镜独立生效，该类不再需要，直接删除即可' },
      fixToken: null,
    };
  }
  // float 布局：已被 flex/grid 取代（float 仅剩文本绕图的合理用途，确需时局部豁免）
  if (unsignedCore.startsWith('float')) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'float 布局请改用 flex/grid（仅文本绕图等确需 float 的场景可局部豁免）' },
      fixToken: null,
    };
  }
  // clear-*：float 的配套补丁，float 消失后没有存在意义
  if (unsignedCore.startsWith('clear-')) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'clear-* 是 float 布局的配套补丁，迁移到 flex/grid 后应一并移除' },
      fixToken: null,
    };
  }
  // CSS 表格显示布局：布局 hack 已被 flex/grid 取代；真实表格应使用 <table> 元素
  if (TABLE_DISPLAY_CLASSES.includes(unsignedCore)) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'CSS 表格显示布局请改用 flex/grid；真实表格请使用 <table> 元素' },
      fixToken: null,
    };
  }
  // 100vh / 100vw：移动端动态视口与横向溢出问题，v4 原生提供 dvh/svh/lvh 系列
  if (VIEWPORT_FALLBACK_PATTERN.test(unsignedCore) || VIEWPORT_ARBITRARY_PATTERN.test(unsignedCore)) {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: '100vh/100vw 存在移动端动态视口与横向溢出问题，请按意图改用 h-dvh / h-svh / h-lvh / w-dvw 等' },
      fixToken: null,
    };
  }
  // container：v4 移除 center/padding 配置项，依赖 tailwind.config.js 定制的行为会静默失效
  if (unsignedCore === 'container') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'v4 移除了 container 的 center/padding 配置，定制容器样式请改用 @utility 指令（见官方"Container configuration"章节）' },
      fixToken: null,
    };
  }
  // inline / inline-block：行内布局整体禁用（配套的 no-inline-elements 元素级禁令见同层）
  if (unsignedCore === 'inline' || unsignedCore === 'inline-block') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: '行内布局已禁用：需要宽高的行内容器请改用 inline-flex，其余场景用块级结构表达' },
      fixToken: null,
    };
  }
  // transform-none：v4 中不再重置 rotate/scale/translate，是行为陷阱
  if (unsignedCore === 'transform-none') {
    return {
      messageId: 'discouragedPattern',
      data: { old: token, new: 'v4 中 transform-none 不再重置 rotate/scale/translate，请用 scale-none / translate-none / rotate-none 单独重置' },
      fixToken: null,
    };
  }
  // 任意值逗号：grid-cols/rows/object 任意值中 v3 的"逗号=空格"兼容已移除，可机械替换为下划线
  for (const prefix of COMMA_ARBITRARY_PREFIXES) {
    if (core.startsWith(prefix) && core.includes(',')) {
      const fixToken = variants + core.replace(/,/g, '_') + importantSuffix;
      return { messageId: 'discouragedPattern', data: { old: token, new: fixToken }, fixToken };
    }
  }

  if (hasImportantPrefix) {
    const fixToken = variants + core + '!';
    return { messageId: 'importantPosition', data: { old: token, new: fixToken }, fixToken };
  }

  const varMatch = VARIABLE_SHORTHAND_PATTERN.exec(core);
  if (varMatch !== null) {
    const fixToken = variants + core.replace('[--', '(--').replace(/\]$/, ')');
    return { messageId: 'variableShorthand', data: { old: token, new: fixToken }, fixToken };
  }

  return null;
};

/** 跨 token 检查（默认色变更陷阱 / outline 冗余），全部 report-only，依赖同一宿主字符串内的上下文。 */
const resolveContextToken = (token: string, context: ScanContext): TokenFinding | null => {
  const unsignedCore = toUnsignedCore(token);

  // bare border：v4 默认边框色 gray-200 → currentColor，同串无显式颜色时提示
  if (unsignedCore === 'border' && !context.hasBorderColor) {
    return {
      messageId: 'missingDefaultColor',
      data: { old: token, new: 'v4 默认边框色已从 gray-200 改为 currentColor，请在同元素显式加上边框颜色（如 border-gray-200）' },
      fixToken: null,
    };
  }
  // ring / ring-3：v4 默认 ring 色 blue-500 → currentColor，同串无显式颜色时提示
  const isRingWidthCore = unsignedCore === 'ring' || unsignedCore === 'ring-3';
  if (isRingWidthCore && !context.hasRingColor) {
    return {
      messageId: 'missingDefaultColor',
      data: { old: token, new: 'v4 默认 ring 色已从 blue-500 改为 currentColor，请在同元素显式加上 ring 颜色（如 ring-blue-500）' },
      fixToken: null,
    };
  }
  // bare outline 与 outline-<number> 并存：v4 中 outline-<number> 自带 outline-style: solid，前者冗余
  if (unsignedCore === 'outline' && context.hasOutlineWidth) {
    return {
      messageId: 'redundantOutline',
      data: { old: token, new: 'v4 中 outline-<number> 已自动设置 outline-style: solid，该类冗余，可删除' },
      fixToken: null,
    };
  }
  return null;
};

/** 两遍扫描：第一遍建跨 token 上下文，第二遍逐 token 做 token 级 + 上下文级判定并记录位置。 */
const scanString = (text: string): TokenRange[] => {
  interface TokenEntry {
    token: string;
    start: number;
    end: number;
  }
  const tokens: TokenEntry[] = [];
  const pattern = /\S+/g;
  let match = pattern.exec(text);
  while (match !== null) {
    tokens.push({ token: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(text);
  }

  const context = buildScanContext(tokens.map((entry) => entry.token));

  const results: TokenRange[] = [];
  for (const entry of tokens) {
    const finding = resolveToken(entry.token);
    if (finding !== null) {
      results.push({ finding, start: entry.start, end: entry.end });
    }
    const contextFinding = resolveContextToken(entry.token, context);
    if (contextFinding !== null) {
      results.push({ finding: contextFinding, start: entry.start, end: entry.end });
    }
  }
  return results;
};

export const noDeprecatedTailwind = createRule({
  name: 'no-deprecated-tailwind',
  meta: {
    type: 'suggestion',
    docs: {
      description: '检测过时的 Tailwind 原子类（v3 → v4 更名 / 移除 / 废弃语法 / 不推荐用法），可机械替换的自动修复。',
    },
    fixable: 'code',
    messages: {
      renamedClass: '原子类 {{old}} 已过时：Tailwind v4 已更名为 {{new}}。',
      removedOpacity: '{{old}} 已在 Tailwind v4 中移除：请改用透明度修饰符写法（如 bg-black/50）。',
      importantPosition: '{{old}} 已过时：important 修饰符应写在类名末尾，应改为 {{new}}。',
      variableShorthand: '{{old}} 已过时：任意值中的 CSS 变量请改用圆括号简写，应改为 {{new}}。',
      discouragedPattern: '{{old}} 已不推荐使用：{{new}}。',
      missingDefaultColor: '{{old}} 缺少显式颜色：{{new}}。',
      redundantOutline: '{{old}} 是冗余类：{{new}}。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // textStart：宿主字符串内容在源码中的绝对起始位置（用于把 token 偏移换算为绝对区间）。
    // fixable：raw 与 cooked 不一致（字符串含转义）时放弃修复，只报错。
    const reportFindings = (node: TSESTree.Node, text: string, textStart: number, fixable: boolean): void => {
      const ranges = scanString(text);
      for (const range of ranges) {
        const fixToken = range.finding.fixToken;
        if (fixToken !== null && fixable) {
          context.report({
            node,
            messageId: range.finding.messageId,
            data: range.finding.data,
            fix: (fixer): TSESLint.RuleFix => fixer.replaceTextRange([textStart + range.start, textStart + range.end], fixToken),
          });
        } else {
          context.report({
            node,
            messageId: range.finding.messageId,
            data: range.finding.data,
          });
        }
      }
    };

    const checkLiteral = (node: TSESTree.Literal): void => {
      const value = node.value;
      if (typeof value !== 'string') {
        return;
      }
      let rawInner = '';
      if (typeof node.raw === 'string') {
        rawInner = node.raw.slice(1, -1);
      }
      const fixable = rawInner === value;
      reportFindings(node, value, node.range[0] + 1, fixable);
    };

    const checkTemplate = (node: TSESTree.TemplateLiteral): void => {
      // 只扫静态段（quasi）；${} 内的表达式交给调用方/开发者自己保证
      for (const quasi of node.quasis) {
        const cooked = quasi.value.cooked;
        if (typeof cooked !== 'string') {
          continue;
        }
        const fixable = quasi.value.raw === cooked;
        reportFindings(quasi, cooked, quasi.range[0], fixable);
      }
    };

    return {
      JSXAttribute(node): void {
        const value = node.value;
        if (value === null) {
          return;
        }
        if (value.type === 'Literal') {
          checkLiteral(value);
          return;
        }
        if (value.type === 'JSXExpressionContainer') {
          const expression = value.expression;
          if (expression.type === 'Literal') {
            checkLiteral(expression);
          }
          if (expression.type === 'TemplateLiteral') {
            checkTemplate(expression);
          }
        }
      },
      CallExpression(node): void {
        const callee = node.callee;
        if (callee.type !== 'Identifier') {
          return;
        }
        if (!UTILITY_FUNCTIONS.includes(callee.name)) {
          return;
        }
        for (const argument of node.arguments) {
          if (argument.type === 'Literal') {
            checkLiteral(argument);
          }
          if (argument.type === 'TemplateLiteral') {
            checkTemplate(argument);
          }
        }
      },
    };
  },
});
