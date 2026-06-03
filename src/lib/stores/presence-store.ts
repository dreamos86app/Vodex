import { create } from "zustand";
import type { PresenceMode, VisiblePresenceStatus } from "@/lib/presence/user-presence";

type PresenceState = {
  presenceMode: PresenceMode;
  visibleStatus: VisiblePresenceStatus;
  label: string;
  loaded: boolean;
  setSnapshot: (input: {
    presenceMode: PresenceMode;
    visibleStatus: VisiblePresenceStatus;
    label: string;
  }) => void;
  reset: () => void;
};

const initial = {
  presenceMode: "auto" as PresenceMode,
  visibleStatus: "offline" as VisiblePresenceStatus,
  label: "Offline",
  loaded: false,
};

export const usePresenceStore = create<PresenceState>((set) => ({
  ...initial,
  setSnapshot: (input) =>
    set({
      presenceMode: input.presenceMode,
      visibleStatus: input.visibleStatus,
      label: input.label,
      loaded: true,
    }),
  reset: () => set(initial),
}));
