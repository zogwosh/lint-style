import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';

/**
 * 自定义规则：逻辑非（!）的操作数只接受布尔值。
 *
 * 拦截的隐式行为：
 *   - if (str) / for / while / && / || 等条件位置由 strict-boolean-expressions
 *     覆盖（报错信息更具体，此处不重复插手）；
 *   - ?? 是显式判空合并（何时必须用由 prefer-nullish-coalescing 引导），
 *     不是真假转换，不在此管制；
 *   - switch 判定是严格相等匹配（IsStrictlyEqual），不存在真假转换，
 *     穷尽性由 switch-exhaustiveness-check 管；
 *   - 本规则补齐剩余唯一的真假转换位置：!x 的操作数。
 *
 * any / never 交由 no-unsafe-* 与 no-explicit-any 处理，此处跳过。
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/lintstyle/lintstyle/blob/main/docs/rules/${name}.md`,
);

export const booleanOnly = createRule({
  name: 'boolean-only',
  meta: {
    type: 'problem',
    docs: {
      description: '逻辑非（!）的操作数只接受布尔值，禁止依赖隐式真假转换。',
    },
    messages: {
      notBoolean: '逻辑非（!）的操作数只接受布尔值，但实际类型是 {{type}}。请显式比较（=== true / !== undefined 等）或用 Boolean() 收窄。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context, true);
    // 无类型信息的环境（纯 JS 项目）直接跳过，此规则只在 typed 层启用
    const program = services.program;
    if (program === null) {
      return {};
    }
    const checker = program.getTypeChecker();

    const isBooleanType = (type: ts.Type): boolean => {
      if (type.isUnion()) {
        return type.types.every(isBooleanType);
      }
      return (type.flags & ts.TypeFlags.BooleanLike) !== 0;
    };

    const requireBoolean = (node: TSESTree.Expression): void => {
      const type = services.getTypeAtLocation(node);
      const flags = type.flags;
      // any / never 交由其他规则处理
      if ((flags & ts.TypeFlags.Any) !== 0 || (flags & ts.TypeFlags.Never) !== 0) {
        return;
      }
      if (isBooleanType(type)) {
        return;
      }
      context.report({
        node,
        messageId: 'notBoolean',
        data: { type: checker.typeToString(type) },
      });
    };

    return {
      UnaryExpression(node): void {
        if (node.operator === '!') {
          requireBoolean(node.argument);
        }
      },
    };
  },
});
