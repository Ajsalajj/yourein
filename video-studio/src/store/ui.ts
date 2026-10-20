"use client";
import { create } from "zustand";

export type TabId = "media" | "captions" | "templates" | "type" | "text" | "audio" | "broll" | "effects" | "transitions" | "ai";
interface UiState { tab: TabId; setTab: (t: TabId) => void }
export const useUi = create<UiState>((set) => ({ tab: "captions", setTab: (tab) => set({ tab }) }));
