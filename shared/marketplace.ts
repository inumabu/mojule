import type { ModuleCategory, ModulePort } from "./module";

export type MarketplaceModule = {
  id: string;
  name: string;
  version: string;
  category: ModuleCategory;
  description: string;
  author: string;
  license: string;
  repository: string;
  tags: string[];
  inputs: ModulePort[];
  outputs: ModulePort[];
};
