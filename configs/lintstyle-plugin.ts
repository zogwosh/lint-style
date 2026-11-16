import type { Plugin, RuleDefinition } from '@eslint/core';

import { booleanOnly } from './rules/boolean-only';
import { noDeprecatedTailwind } from './rules/no-deprecated-tailwind';
import { noDynamicPropertyAccess } from './rules/no-dynamic-property-access';
import { noInlineElements } from './rules/no-inline-elements';
import { noSilentCatch } from './rules/no-silent-catch';

/**
 * lintstyle 自定义规则插件的唯一注册点。
 *
 * base 层（no-silent-catch，不需要类型信息）与 typed 层
 * （boolean-only / no-dynamic-property-access，需要类型信息）必须引用
 * 同一个插件实例——flat config 中同名插件若在多个配置对象里各自 new
 * 一个实例，后注册的会覆盖先注册的，导致规则丢失。
 */
export const lintstylePlugin: Plugin = {
  rules: {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tseslint 规则类型与 eslint v10 互操作
    'boolean-only': booleanOnly as unknown as RuleDefinition,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tseslint 规则类型与 eslint v10 互操作
    'no-deprecated-tailwind': noDeprecatedTailwind as unknown as RuleDefinition,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tseslint 规则类型与 eslint v10 互操作
    'no-dynamic-property-access': noDynamicPropertyAccess as unknown as RuleDefinition,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tseslint 规则类型与 eslint v10 互操作
    'no-inline-elements': noInlineElements as unknown as RuleDefinition,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tseslint 规则类型与 eslint v10 互操作
    'no-silent-catch': noSilentCatch as unknown as RuleDefinition,
  },
};
