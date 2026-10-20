"use client";
import { create } from "zustand";

/** Per-browser conveniences (favourites, recents). Never required for correctness: storage may be unavailable. */
const KEY = "cadence:prefs:v1";
interface Prefs { favorites: string[]; recents: string[] }
const read = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.favorites) && Array.isArray(p.recents)) return { favorites: p.favorites.map(String), recents: p.recents.map(String) };
  } catch { /* ignore */ }
  return { favorites: [], recents: [] };
};
const write = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

interface State extends Prefs {
  hydrated: boolean;
  hydrate: () => void;
  toggleFavorite: (id: string) => void;
  pushRecent: (id: string) => void;
}

export const usePrefs = create<State>((set, get) => ({
  favorites: [],
  recents: [],
  hydrated: false,
  hydrate: () => { if (!get().hydrated) set({ ...read(), hydrated: true }); },
  toggleFavorite: (id) => {
    const f = get().favorites;
    const favorites = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f];
    set({ favorites }); write({ favorites, recents: get().recents });
  },
  pushRecent: (id) => {
    const recents = [id, ...get().recents.filter((x) => x !== id)].slice(0, 8);
    set({ recents }); write({ favorites: get().favorites, recents });
  },
}));
