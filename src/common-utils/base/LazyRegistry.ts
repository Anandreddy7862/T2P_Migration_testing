import type { Page } from '@playwright/test';

/** Anything constructible from a Page - every page and module class qualifies. */
type PageConstructed<T> = new (page: Page) => T;

export interface LazyRegistryOptions {
  /** Appended to the capitalised property name, e.g. "Module". */
  classNameSuffix?: string;
}

/**
 * Turns a barrel of classes into a lazily-instantiated, cached registry.
 *
 * Adding a page or module is ONE export line in the barrel - no hand-written
 * getters. Property access is intercepted, mapped to a class name (capitalise
 * the first letter, plus an optional suffix), instantiated once per test and
 * cached.
 */
export function createLazyRegistry<TInstances extends object>(
  page: Page,
  classes: Record<string, PageConstructed<unknown>>,
  options: LazyRegistryOptions = {},
): TInstances {
  const cache = new Map<string, unknown>();
  const suffix = options.classNameSuffix ?? '';

  return new Proxy({} as TInstances, {
    get(_target, property: string | symbol): unknown {
      if (typeof property !== 'string') return undefined;
      if (cache.has(property)) return cache.get(property);

      const className = `${property.charAt(0).toUpperCase()}${property.slice(1)}${suffix}`;
      const ctor = classes[className];
      if (!ctor) {
        throw new Error(
          `"${property}" is not registered. Expected a class named "${className}" exported from the barrel. ` +
            `Registered: ${Object.keys(classes).sort().join(', ')}`,
        );
      }

      const instance = new ctor(page);
      cache.set(property, instance);
      return instance;
    },
  });
}
