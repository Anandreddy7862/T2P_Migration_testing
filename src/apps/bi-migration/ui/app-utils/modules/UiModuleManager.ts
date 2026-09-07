import type { Page } from '@playwright/test';

import { createLazyRegistry } from '@common-utils/base/LazyRegistry';

import * as modules from './index';

/**
 * Lazily-instantiated module registry.
 *
 * `uiModuleManager.tableauLogin` maps to the exported class `TableauLoginModule`
 * (capitalise, append "Module"), constructed once per test and cached.
 */
type ModuleClasses = typeof modules;

type ModuleInstances = {
  [Key in keyof ModuleClasses as Uncapitalize<Key extends `${infer Base}Module` ? Base : Key & string>]: InstanceType<
    ModuleClasses[Key]
  >;
};

export interface UiModuleManager extends ModuleInstances {}

export class UiModuleManager {
  constructor(page: Page) {
    return createLazyRegistry<UiModuleManager>(
      page,
      modules as unknown as Record<string, new (page: Page) => unknown>,
      { classNameSuffix: 'Module' },
    );
  }
}
