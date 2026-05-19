export type ModuleLayer =
  | "experience"
  | "core"
  | "runtime"
  | "skills"
  | "integration"
  | "orchestration"
  | "native"
  | "tooling"
  | "contracts"
  | "docs";

export type ModuleKind =
  | "contract"
  | "implementation"
  | "configuration"
  | "content"
  | "documentation"
  | "contract-and-implementation";

export interface ModuleBoundaryEntry {
  id: string;
  label: string;
  layer: ModuleLayer;
  kind: ModuleKind;
  paths: string[];
  owns: string[];
  shouldMoveToward?: string;
}

export interface ModuleMap {
  version: number;
  updatedAt: string;
  modules: ModuleBoundaryEntry[];
}
