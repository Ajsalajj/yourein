"use client";

import { useEffect, useRef, useState } from "react";
import { MUSIC_FILTERS, MUSIC_VOLUMES, RECOMMENDED, TRACKS, getTrack, type MusicFilter, type Track } from "@/data/music";
import { mediaUrl, musicSourceOf, type InviteData } from "@/lib/invite";

type MusicFields = Pick<InviteData, "music" | "musicSource" | "musicTrack" | "musicName" | "musicVolume" | "musicStart">;
type Props = MusicFields & {
  templateSlug: string;
  onPatch: (p: Partial<MusicFields>) => void;
  onUpload: (files: FileList | null) => void;
  uploading: string | null;
  uploadError: string;
};

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      {playing ? <path d="M8 5.5v13M16 5.5v13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /> : <path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor" />}
    </svg>
  );
}

/**
 * Background music in the editor: a curated library (previews play one at a time) or the host's own file.
 * Audio loads only when a preview is played.
 */
export function MusicPicker({ templateSlug, music, musicSource, musicTrack, musicName, musicVolume, musicStart, onPatch, onUpload, uploading, uploadError }: Props) {
  const source = musicSourceOf({ musicSource, music, musicTrack });
  const [tab, setTab] = useState<"library" | "upload">(source === "upload" ? "upload" : "library");
  const [filter, setFilter] = useState<MusicFilter | "All">("All");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [pos, setPos] = useState({ cur: 0, dur: NaN });
  const [uploadDur, setUploadDur] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* one preview at a time; nothing is downloaded until play is tapped */
  const play = (id: string, url: string) => {
    let a = audio.current;
    if (playingId === id && a) {
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
      return;
    }
    a?.pause();
    a = new Audio(url);
    a.preload = "none";
    a.volume = 0.6;
    a.addEventListener("timeupdate", () => setPos({ cur: a!.currentTime, dur: a!.duration }));
    a.addEventListener("loadedmetadata", () => setPos({ cur: 0, dur: a!.duration }));
    a.addEventListener("play", () => setPaused(false));
    a.addEventListener("pause", () => setPaused(true));
    a.addEventListener("ended", () => setPaused(true));
    audio.current = a;
    setPlayingId(id);
    setPos({ cur: 0, dur: NaN });
    void a.play().catch(() => setPaused(true));
  };
  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlayingId(null);
  };
  useEffect(() => () => audio.current?.pause(), []);

  const uploadUrl = music ? mediaUrl(music) : "";
  /* duration of the host's own file, read from its metadata only */
  useEffect(() => {
    if (!uploadUrl) return setUploadDur(null);
    const a = new Audio();
    a.preload = "metadata";
    a.src = uploadUrl;
    const on = () => setUploadDur(a.duration);
    a.addEventListener("loadedmetadata", on);
    return () => a.removeEventListener("loadedmetadata", on);
  }, [uploadUrl]);

  const active = TRACKS.filter((t) => t.active);
  const recommended = (RECOMMENDED[templateSlug] ?? []).map(getTrack).filter((t): t is Track => !!t && t.active);
  const shown = filter === "All" ? active.filter((t) => !recommended.includes(t)) : active.filter((t) => t.filters.includes(filter));
  const selected = source === "builtin" ? getTrack(musicTrack) : undefined;
  const playingTrack = playingId === "upload" ? { title: musicName || "Your music" } : getTrack(playingId);

  const row = (t: Track) => {
    const isPlaying = playingId === t.id && !paused, isSel = selected?.id === t.id;
    return (
      <div key={t.id} className="mp-row" data-selected={isSel}>
        <button type="button" className="mp-play" onClick={() => play(t.id, t.url)} aria-label={`${isPlaying ? "Pause" : "Play"} ${t.title}`} aria-pressed={isPlaying}>
          <PlayIcon playing={isPlaying} />
        </button>
        <div className="mp-info">
          <b>{t.title}</b>
          <span>{t.mood} · {t.style}</span>
          <small>{t.label} · {t.duration}</small>
          {playingId === t.id && <i className="mp-progress"><i style={{ width: `${pos.dur ? (pos.cur / pos.dur) * 100 : 0}%` }} /></i>}
        </div>
        <button type="button" className={`mp-select${isSel ? " is-on" : ""}`} onClick={() => onPatch({ musicSource: "builtin", musicTrack: t.id })} aria-pressed={isSel} aria-label={isSel ? `${t.title} selected` : `Select ${t.title}`}>
          {isSel ? "✓ Selected" : "Select"}
        </button>
      </div>
    );
  };

  return (
    <div className="mp">
      <div className="mp-current">
        <span className="mp-note" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM19 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        </span>
        <span className="mp-current-text">
          <small>Selected music</small>
          <b>{selected ? selected.title : source === "upload" ? musicName || "Your own music" : "No music"}</b>
        </span>
        {source !== "none" ? (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => onPatch({ musicSource: "none" })}>Remove</button>
        ) : (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>Choose</button>
        )}
      </div>

      <div className="mp-seg" role="tablist" aria-label="Music source">
        <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>Music library</button>
        <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>Upload your own</button>
      </div>

      {tab === "library" ? (
        <div ref={listRef} className="mp-lib">
          <div className="mp-chips" role="group" aria-label="Filter music">
            {(["All", ...MUSIC_FILTERS] as const).map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {filter === "All" && recommended.length > 0 && (
            <>
              <p className="mp-h">Recommended for this design</p>
              <div className="mp-list">{recommended.map(row)}</div>
              <p className="mp-h">All tracks</p>
            </>
          )}
          <div className="mp-list">{shown.map(row)}</div>
          <p className="hint">Original instrumental music made for YoureIn, free to use on your invitation.</p>
        </div>
      ) : (
        <div ref={listRef} className="mp-upload">
          {music ? (
            <div className="mp-row" data-selected={source === "upload"}>
              <button type="button" className="mp-play" onClick={() => play("upload", uploadUrl)} aria-label={`${playingId === "upload" && !paused ? "Pause" : "Play"} your music`}>
                <PlayIcon playing={playingId === "upload" && !paused} />
              </button>
              <div className="mp-info">
                <b>{musicName || "Your music"}</b>
                <span>Your upload{uploadDur ? ` · ${fmt(uploadDur)}` : ""}</span>
                {playingId === "upload" && <i className="mp-progress"><i style={{ width: `${pos.dur ? (pos.cur / pos.dur) * 100 : 0}%` }} /></i>}
              </div>
              <button type="button" className={`mp-select${source === "upload" ? " is-on" : ""}`} onClick={() => onPatch({ musicSource: "upload" })} aria-pressed={source === "upload"}>
                {source === "upload" ? "✓ Selected" : "Use this"}
              </button>
            </div>
          ) : (
            <label className="mp-drop file-btn">
              <b>Add your music</b>
              <span>MP3, M4A, AAC or WAV, up to 4 MB</span>
              <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,.mp3,.m4a,.aac,.wav" onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          {music && (
            <div className="chips">
              <label className="btn btn-quiet btn-sm file-btn">
                Replace
                <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,.mp3,.m4a,.aac,.wav" onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
              </label>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { if (playingId === "upload") stop(); onPatch({ music: null, musicName: "", musicSource: "none" }); }}>Remove</button>
            </div>
          )}
          <p className="hint" role="status">{uploading || "Use music you have the right to share. A short file loads fastest for guests."}</p>
          {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
        </div>
      )}

      {source !== "none" && (
        <div className="mp-settings">
          <div className="field">
            <span className="field-label">Volume</span>
            <div className="chips" role="radiogroup" aria-label="Music volume">
              {MUSIC_VOLUMES.map(([label, v]) => (
                <button key={label} type="button" className="chip" role="radio" aria-checked={musicVolume === v} onClick={() => onPatch({ musicVolume: v })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Starts</span>
            <div className="chips" role="radiogroup" aria-label="When the music starts">
              <button type="button" className="chip" role="radio" aria-checked={musicStart === "on_open"} onClick={() => onPatch({ musicStart: "on_open" })}>When the invitation opens</button>
              <button type="button" className="chip" role="radio" aria-checked={musicStart === "manual"} onClick={() => onPatch({ musicStart: "manual" })}>When the guest taps play</button>
            </div>
            <small>Browsers never play sound before a tap, so music always starts after the guest opens the invitation, fading in gently.</small>
          </div>
        </div>
      )}

      {playingId && playingTrack && (
        <div className="mp-mini" role="region" aria-label="Now playing">
          <button type="button" className="mp-play" onClick={() => audio.current && (audio.current.paused ? void audio.current.play() : audio.current.pause())} aria-label={paused ? `Play ${playingTrack.title}` : `Pause ${playingTrack.title}`}>
            <PlayIcon playing={!paused} />
          </button>
          <div className="mp-mini-info">
            <b>{playingTrack.title}</b>
            <input type="range" min={0} max={Number.isFinite(pos.dur) ? pos.dur : 0} step={0.1} value={pos.cur} onChange={(e) => { if (audio.current) audio.current.currentTime = Number(e.target.value); }} aria-label="Seek" />
            <small>{fmt(pos.cur)} / {fmt(pos.dur)}</small>
          </div>
          <button type="button" className="mp-mini-x" onClick={stop} aria-label="Stop preview">✕</button>
        </div>
      )}
    </div>
  );
}
