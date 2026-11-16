import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * 自定义规则：禁止静默吞错（Go "err 必须处理" 的对应物）。
 *
 * 拦截的形态：
 *   - 空 catch 块：catch {} / catch (e) {} —— 错误被无声丢弃；
 *   - 空的 Promise 拒绝处理器：.catch(() => {}) 与 .then(ok, () => {}) ——
 *     同步 try/catch 的吞错写法在 Promise 链上的等价物，
 *     no-floating-promises 管不到"已接住但丢弃"的场景，由此处补齐；
 *   - 未 await 的 Promise（整条链被丢弃）由 typed 层 no-floating-promises 拦截；
 *   - catch 参数声明了却不用，由 no-unused-vars（caughtErrors: 'all'）拦截。
 *
 * 豁免通道：块内写注释（显式留痕说明为何忽略），与 no-empty 对注释块
 * 的放行行为保持一致——允许"有意忽略"，不允许"无声忽略"。
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/lintstyle/lintstyle/blob/main/docs/rules/${name}.md`,
);

export const noSilentCatch = createRule({
  name: 'no-silent-catch',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止空 catch 块与空 Promise 拒绝处理器静默吞错，显式忽略必须注释留痕。',
    },
    messages: {
      emptyCatch: '禁止空 catch 吞错。请处理错误（记录、包装后重抛或恢复）；确需忽略时在块内写注释说明理由。',
      emptyRejectionHandler: '禁止空的 Promise 拒绝处理器吞错（.catch(() => {}) / .then(ok, () => {})）。请处理错误；确需忽略时在函数体内写注释说明理由。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;

    // 空块 = 无语句且无注释（注释即显式留痕，放行）
    const isEmptyBlock = (block: TSESTree.BlockStatement): boolean =>
      block.body.length === 0 && sourceCode.getCommentsInside(block).length === 0;

    const checkRejectionHandler = (handler: TSESTree.Expression | TSESTree.SpreadElement | undefined): void => {
      if (handler === undefined) {
        return;
      }
      const isFunction = handler.type === 'ArrowFunctionExpression' || handler.type === 'FunctionExpression';
      if (!isFunction) {
        return;
      }
      if (handler.body.type !== 'BlockStatement') {
        return;
      }
      if (!isEmptyBlock(handler.body)) {
        return;
      }
      context.report({ node: handler, messageId: 'emptyRejectionHandler' });
    };

    return {
      CatchClause(node): void {
        if (isEmptyBlock(node.body)) {
          context.report({ node, messageId: 'emptyCatch' });
        }
      },
      CallExpression(node): void {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) {
          return;
        }
        if (callee.property.type !== 'Identifier') {
          return;
        }
        if (callee.property.name === 'catch') {
          checkRejectionHandler(node.arguments[0]);
        } else if (callee.property.name === 'then') {
          // then(ok, onRejected)：第二个参数才是拒绝处理器
          checkRejectionHandler(node.arguments[1]);
        }
      },
    };
  },
});
