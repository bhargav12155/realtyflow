// Re-export the canonical union types from the shared schema module so the
// client and server agree on the legal HeyGen status values. Server boundary
// validation uses the same Zod enums (see `shared/heygenPhotoAvatarSchemas.ts`).
export type {
  AvatarGroupStatus,
  AvatarTrainStatus,
  ConsentStatus,
  AvatarLookProcessingStatus,
} from "@shared/heygenPhotoAvatarSchemas";

import type {
  AvatarGroupStatus,
  AvatarTrainStatus,
  ConsentStatus,
  AvatarLookProcessingStatus,
} from "@shared/heygenPhotoAvatarSchemas";

export interface AvatarGroup {
  group_id: string;
  name: string;
  status: AvatarGroupStatus;
  created_at: string | number;
  avatar_count?: number;
  training_progress?: number;
  train_status?: AvatarTrainStatus;
  num_looks?: number;
  preview_image?: string;
  api_version?: string;
  consent_status?: ConsentStatus | null;
}

export type AgeOption =
  | "Young Adult"
  | "Early Middle Age"
  | "Late Middle Age"
  | "Senior"
  | "Unspecified";

export type GenderOption = "Man" | "Woman" | "Person";

export type OrientationOption = "horizontal" | "vertical";

export type PoseOption = "full_body" | "half_body" | "close_up";

export type StyleOption =
  | "Realistic"
  | "Pixar"
  | "Cinematic"
  | "Vintage"
  | "Noir"
  | "Cyberpunk"
  | "Unspecified";

export interface PhotoGenerationRequest {
  name: string;
  age: AgeOption;
  gender: GenderOption;
  ethnicity: string;
  orientation: OrientationOption;
  pose: PoseOption;
  style: StyleOption;
  appearance: string;
}

export type EditOrientation = "square" | "landscape" | "portrait";
export type EditPose = "half_body" | "full_body";

export type AILookOrientation = "square" | "horizontal" | "vertical";
export type AILookPose = "half_body" | "close_up" | "full_body";

export interface AvatarLook {
  id: string;
  groupId: string;
  groupName?: string;
  photoUrl?: string;
  poseType?: string;
  processingStatus?: AvatarLookProcessingStatus;
}

export type ActivityLogStep =
  | "upload"
  | "group_created"
  | "waiting"
  | "training_started"
  | "training_progress"
  | "training_complete"
  | "generating_looks"
  | "looks_complete"
  | "error";

export type ActivityLog = {
  id: string;
  timestamp: string;
  step: ActivityLogStep;
  message: string;
  groupName?: string;
  details?: string;
};

export type DebugLogType = "request" | "response" | "info" | "error";

export type DebugLog = {
  timestamp: string;
  type: DebugLogType;
  endpoint?: string;
  payload?: unknown;
  response?: unknown;
  message?: string;
};
