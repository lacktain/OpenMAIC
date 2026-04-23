// lib/export/classroom-zip-types.ts
import type { SceneType, SceneContent } from '@/lib/types/stage';
import type { Action } from '@/lib/types/action';
import type { PedagogicalBlueprintRecord } from '@/lib/types/blueprint';
import type { Slide } from '@/lib/types/slides';

export const CLASSROOM_ZIP_FORMAT_VERSION = 1;
export const CLASSROOM_ZIP_EXTENSION = '.maic.zip';

export interface ClassroomManifest {
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  stage: ManifestStage;
  agents: ManifestAgent[];
  scenes: ManifestScene[];
  mediaIndex: Record<string, MediaIndexEntry>;
}

export interface ManifestStage {
  name: string;
  description?: string;
  language?: string;
  style?: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Preserve teacher-reviewed pedagogical metadata across classroom sharing
   * so exported classrooms can be inspected, re-imported, and re-exported
   * without losing the review contract.
   */
  pedagogicalBlueprint?: PedagogicalBlueprintRecord;
}

export interface ManifestAgent {
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  priority: number;
  /** Reserved for forward-compat. Not currently persisted in GeneratedAgentRecord DB schema. */
  voiceConfig?: { providerId: string; voiceId: string };
}

export interface ManifestScene {
  type: SceneType;
  title: string;
  order: number;
  content: SceneContent;
  actions?: ManifestAction[];
  whiteboards?: Slide[];
  multiAgent?: {
    enabled: boolean;
    agentIndices: number[];
    directorPrompt?: string;
  };
}

export type ManifestAction = Omit<Action, 'audioId'> & {
  audioRef?: string;
};

export interface MediaIndexEntry {
  type: 'audio' | 'image' | 'generated';
  mimeType?: string;
  format?: string;
  duration?: number;
  voice?: string;
  size?: number;
  prompt?: string;
  missing?: boolean;
}
