import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * 自定义规则：禁止行内元素，文本流统一通过 div 块级结构表达。
 *
 * 禁用范围（两档全禁，用户确认）：
 *   - 表现性/废弃标签：span、b / i / u / s、strike、small、big、font、tt、br、wbr；
 *   - 语义强调/标注类：strong、em、del、ins、mark、abbr、dfn、cite、q、time、data、
 *     var、samp、kbd、code、sub、sup、ruby、rt、rp、bdi、bdo。
 *
 * 豁免（功能必需的行内元素）：
 *   - a：链接功能必需；
 *   - label：表单可访问性必需。
 * 表单控件与嵌入媒体（input / select / textarea / button / img / svg / video 等）
 * 不属于文本级行内格式元素，不在禁用列表内。
 *
 * 需要强调/标注文本时：用块级结构表达；确需行内语义时局部 eslint-disable 并注明理由。
 * 配套禁令：display 层面的 inline / inline-block 由 no-deprecated-tailwind 拦截，
 * 行内容器统一走 inline-flex。
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/lintstyle/lintstyle/blob/main/docs/rules/${name}.md`,
);

const BANNED_INLINE_ELEMENTS: readonly string[] = [
  // 表现性 / 废弃标签
  'span',
  'b',
  'i',
  'u',
  's',
  'strike',
  'small',
  'big',
  'font',
  'tt',
  'br',
  'wbr',
  // 语义强调 / 标注类
  'strong',
  'em',
  'del',
  'ins',
  'mark',
  'abbr',
  'dfn',
  'cite',
  'q',
  'time',
  'data',
  'var',
  'samp',
  'kbd',
  'code',
  'sub',
  'sup',
  'ruby',
  'rt',
  'rp',
  'bdi',
  'bdo',
];

export const noInlineElements = createRule({
  name: 'no-inline-elements',
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止行内元素（span / strong / em 等语义化 HTML 标签），文本流统一通过 div 块级结构表达；a 与 label 豁免。',
    },
    messages: {
      bannedElement: '禁止使用行内元素 <{{element}}>：文本流统一通过 div 块级结构表达；确需行内语义时局部 eslint-disable 并注明理由。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXElement(node): void {
        const elementName = node.openingElement.name;
        if (elementName.type !== 'JSXIdentifier') {
          return;
        }
        if (BANNED_INLINE_ELEMENTS.includes(elementName.name)) {
          context.report({
            node: node.openingElement,
            messageId: 'bannedElement',
            data: { element: elementName.name },
          });
        }
      },
    };
  },
});
