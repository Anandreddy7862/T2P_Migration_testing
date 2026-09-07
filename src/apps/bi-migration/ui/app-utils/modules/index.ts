/**
 * Module barrel. Adding a module = ONE export line here; the class name becomes
 * the registry key with a `Module` suffix, so `TableauLoginModule` is reachable
 * as `uiModuleManager.tableauLogin`.
 */
export { TableauLoginModule } from './tableau/TableauLoginModule';
export { TableauVisualDataModule } from './tableau/TableauVisualDataModule';
export { PowerBiLoginModule } from './powerbi/PowerBiLoginModule';
export { PowerBiVisualDataModule } from './powerbi/PowerBiVisualDataModule';
