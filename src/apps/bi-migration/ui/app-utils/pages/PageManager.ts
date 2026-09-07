import type { Page } from '@playwright/test';

import { createLazyRegistry } from '@common-utils/base/LazyRegistry';

import * as pages from './index';

/**
 * Lazily-instantiated page registry.
 *
 * `pm.tableauSignInPage` is intercepted by a Proxy, mapped to the exported class
 * `TableauSignInPage`, constructed once per test and cached. Declaration merging
 * gives full IntelliSense without hand-written getters.
 */
type PageClasses = typeof pages;

type PageInstances = {
  [Key in keyof PageClasses as Uncapitalize<Key & string>]: InstanceType<PageClasses[Key]>;
};

export interface PageManager extends PageInstances {}

export class PageManager {
  constructor(page: Page) {
    return createLazyRegistry<PageManager>(page, pages as unknown as Record<string, new (page: Page) => unknown>);
  }
}
