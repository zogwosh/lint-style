import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';

/**
 * 自定义规则：禁止动态属性访问（obj[expr]）与对象字面量动态键（{ [expr]: v }）。
 *
 * 对象形状必须在编译期确定——动态取键是原型链方法泄漏、注入攻击与
 * "键拼写错误静默变成 undefined"的共同根源。
 *
 * 放行的形态：
 *   - 数组 / 元组下标（数字索引在编译期可确定元素类型）：arr[i]、tuple[0]
 *   - 静态字符串键：obj['x']（由 @typescript-eslint/dot-notation 收编为点号访问）
 *   - 数字字面量键：obj[0]
 *   - 静态 Symbol.xxx 键（如 { [Symbol.iterator]: ... }）；Symbol.for('...') 是
 *     运行时字符串查全局注册表，不放行
 *   - 类上的计算方法名（MethodDefinition）、类字段键（PropertyDefinition，
 *     含 abstract）与对象字面量键同规则约束
 *   - 键值集合一律用 Map（map.get(key)，不经过对象原型链）
 *
 * any / never 交由 no-unsafe-* 与 no-explicit-any 处理，此处跳过。
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/lintstyle/lintstyle/blob/main/docs/rules/${name}.md`,
);

export const noDynamicPropertyAccess = createRule({
  name: 'no-dynamic-property-access',
  meta: {
    type: 'problem',
    docs: {
      description: '禁止动态属性访问与对象字面量动态键，对象形状必须在编译期确定。',
    },
    messages: {
      dynamicAccess:
        '禁止动态属性访问 obj[...]（实际类型：{{type}}）。数组/元组可用下标取值；键值集合请用 Map（map.get(key)）；固定键请用点号访问。',
      dynamicKey:
        '禁止对象字面量使用动态键 [expr]（对象形状在编译期不可确定），请用普通键名，键值集合改用 Map。',
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

    // 只有"数字索引可取值"的类型（数组 / 元组）放行动态下标
    const isNumberIndexable = (type: ts.Type): boolean => {
      if (type.isUnion()) {
        return type.types.every(isNumberIndexable);
      }
      return checker.getIndexInfoOfType(type, ts.IndexKind.Number) !== undefined;
    };

    const isStaticKey = (node: TSESTree.Expression | TSESTree.PrivateIdentifier): boolean => {
      if (node.type === 'Literal') {
        return typeof node.value === 'string' || typeof node.value === 'number';
      }
      return false;
    };

    // 键是否为静态已知的 Symbol.xxx 形态（如 [Symbol.iterator]）。
    // Symbol.for('...') / Symbol['for'](...) 是运行时拿字符串查全局注册表，
    // 键值在编译期不可知，明确不放行
    const isStaticSymbolKey = (node: TSESTree.Expression | TSESTree.PrivateIdentifier): boolean => {
      if (node.type !== 'MemberExpression') {
        return false;
      }
      if (node.object.type !== 'Identifier' || node.object.name !== 'Symbol') {
        return false;
      }
      if (node.computed) {
        // Symbol['iterator'] 放行，Symbol['for'] 拦截
        return node.property.type === 'Literal' && node.property.value !== 'for';
      }
      return node.property.type === 'Identifier' && node.property.name !== 'for';
    };

    return {
      MemberExpression(node): void {
        if (!node.computed) {
          return;
        }
        if (isStaticKey(node.property)) {
          return;
        }
        const type = services.getTypeAtLocation(node.object);
        // any / never 交由其他规则处理
        if ((type.flags & ts.TypeFlags.Any) !== 0 || (type.flags & ts.TypeFlags.Never) !== 0) {
          return;
        }
        if (isNumberIndexable(type)) {
          return;
        }
        context.report({
          node,
          messageId: 'dynamicAccess',
          data: { type: checker.typeToString(type) },
        });
      },
      Property(node): void {
        if (!node.computed) {
          return;
        }
        const key = node.key;
        if (isStaticKey(key)) {
          return;
        }
        // Symbol.xxx 是静态已知值（如 [Symbol.iterator]）放行；
        // Symbol.for('...') 是运行时字符串查全局注册表，拦截
        if (isStaticSymbolKey(key)) {
          return;
        }
        context.report({ node, messageId: 'dynamicKey' });
      },
      MethodDefinition(node): void {
        // 类上的计算方法名同样必须编译期确定：
        // class A { ['x' + i]() {} } 这类动态方法名在此拦截
        if (!node.computed) {
          return;
        }
        const key = node.key;
        if (isStaticKey(key)) {
          return;
        }
        if (isStaticSymbolKey(key)) {
          return;
        }
        context.report({ node, messageId: 'dynamicKey' });
      },
      PropertyDefinition(node): void {
        // 类字段（含 abstract，typescript-eslint v8 中统一为 PropertyDefinition）
        // 的计算键与方法名同规则约束：
        // class A { [k]: string } 这类动态字段名在此拦截
        if (!node.computed) {
          return;
        }
        const key = node.key;
        if (isStaticKey(key)) {
          return;
        }
        if (isStaticSymbolKey(key)) {
          return;
        }
        context.report({ node, messageId: 'dynamicKey' });
      },
    };
  },
});
