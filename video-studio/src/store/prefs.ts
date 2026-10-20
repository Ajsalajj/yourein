"use client";
import { create } from "zustand";
import type { WordStyle } from "@/lib/wordstyle";

/** Per-browser conveniences (favourites, recents). Never required for correctness: storage may be unavailable. */
const KEY = "cadence:prefs:v1";
export interface SavedStyle { id: string; name: string; style: WordStyle }
interface Prefs { favorites: string[]; recents: string[]; myStyles: SavedStyle[] }
const read = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.favorites) && Array.isArray(p.recents)) return { favorites: p.favorites.map(String), recents: p.recents.map(String), myStyles: Array.isArray(p.myStyles) ? p.myStyles.filter((x: SavedStyle) => x && typeof x.id === "string" && typeof x.name === "string" && x.style && typeof x.style === "object") : [] };
  } catch { /* ignore */ }
  return { favorites: [], recents: [], myStyles: [] };
};
const write = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

interface State extends Prefs {
  hydrated: boolean;
  hydrate: () => void;
  toggleFavorite: (id: string) => void;
  pushRecent: (id: string) => void;
  saveStyle: (name: string, style: WordStyle) => void;
  deleteStyle: (id: string) => void;
}

export const usePrefs = create<State>((set, get) => ({
  favorites: [],
  recents: [],
  myStyles: [],
  hydrated: false,
  hydrate: () => { if (!get().hydrated) set({ ...read(), hydrated: true }); },
  toggleFavorite: (id) => {
    const f = get().favorites;
    const favorites = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f];
    set({ favorites }); write({ favorites, recents: get().recents, myStyles: get().myStyles });
  },
  pushRecent: (id) => {
    const recents = [id, ...get().recents.filter((x) => x !== id)].slice(0, 8);
    set({ recents }); write({ favorites: get().favorites, recents, myStyles: get().myStyles });
  },
  saveStyle: (name, style) => {
    const myStyles = [{ id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim().slice(0, 40) || "My style", style }, ...get().myStyles].slice(0, 60);
    set({ myStyles }); write({ favorites: get().favorites, recents: get().recents, myStyles });
  },
  deleteStyle: (id) => {
    const myStyles = get().myStyles.filter((s) => s.id !== id);
    set({ myStyles }); write({ favorites: get().favorites, recents: get().recents, myStyles });
  },
}));
