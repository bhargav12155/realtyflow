import { createContext, useContext } from "react";
import type { PhotoAvatarManagerState } from "./hooks";

const PhotoAvatarContext = createContext<PhotoAvatarManagerState | null>(null);

export function PhotoAvatarProvider({
  value,
  children,
}: {
  value: PhotoAvatarManagerState;
  children: React.ReactNode;
}) {
  return (
    <PhotoAvatarContext.Provider value={value}>
      {children}
    </PhotoAvatarContext.Provider>
  );
}

export function usePhotoAvatars(): PhotoAvatarManagerState {
  const ctx = useContext(PhotoAvatarContext);
  if (!ctx) throw new Error("usePhotoAvatars must be used within PhotoAvatarProvider");
  return ctx;
}
