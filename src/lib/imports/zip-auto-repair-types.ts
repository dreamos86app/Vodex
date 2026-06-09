import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { DetectedFrameworkId } from "@/lib/imports/framework-detector";

export type ZipAutoRepairAction = {
  path: string;
  action: "created" | "modified";
  reason: string;
};

export type ZipAutoRepairResult = {
  repairedFiles: ZipImportFile[];
  repairActions: ZipAutoRepairAction[];
  warnings: string[];
  blockers: string[];
  canBuild: boolean;
  framework: DetectedFrameworkId;
  confidence: number;
  modifiedPaths: string[];
};

export type ZipAutoRepairMetadata = {
  actions: ZipAutoRepairAction[];
  warnings: string[];
  blockers: string[];
  timestamp: string;
  framework: string;
  confidence: number;
  canBuild: boolean;
};
