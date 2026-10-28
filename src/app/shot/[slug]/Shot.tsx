"use client";

import { useEffect, useState } from "react";
import { getTemplate } from "@/data/templates";
import { loadArt } from "@/invite/art";
import type { ArtModule } from "@/invite/art/types";
import { ArtDefs } from "@/invite/art/kit";
import { HeroStage } from "@/invite/HeroStage";
import { themeVars } from "@/invite/fonts";
import "@/invite/invitation.css";

export default function Shot({ slug }: { slug: string }) {
  const t = getTemplate(slug)!;
  const [art, setArt] = useState<ArtModule | null>(null);
  const [sealed, setSealed] = useState<boolean>(!!t.thumbCover);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("state");
    if (q) setSealed(q === "sealed");
    loadArt(slug).then((a) => setArt(() => a));
  }, [slug]);

  return (
    <div
      id="shot"
      className="inv"
      data-dark={t.theme.dark ? "true" : "false"}
      data-skin={t.theme.skin}
      data-ready={art ? "true" : "false"}
      style={{ ...themeVars(t.theme), width: "100vw", height: "100vh", ["--ih" as string]: "100vh" }}
    >
      <style>{`.drift{display:none}.sc-soft>svg,.sc-layer>svg{animation:none!important}`}</style>
      <ArtDefs />
      {art && <HeroStage t={t} art={art} sealed={sealed} />}
    </div>
  );
}
