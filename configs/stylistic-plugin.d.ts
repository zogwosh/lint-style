// @stylistic/eslint-plugin v6 未自带类型声明，此处手动补一个最小声明
declare module '@stylistic/eslint-plugin' {
  import type { RuleDefinition } from '@eslint/core';

  const plugin: { rules: Record<string, RuleDefinition> };
  export default plugin;
}
