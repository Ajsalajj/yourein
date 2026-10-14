import Link from "next/link";
import type { Template } from "@/data/templates";
import { PreviewButton } from "@/components/preview/PreviewProvider";
import { CustomizeLink, EyeIcon } from "./Actions";
import Image from "next/image";
import { Price } from "./Price";

export function TemplateCard({ t, priority }: { t: Template; priority?: boolean }) {
  return (
    <article className="card">
      <PreviewButton slug={t.slug} className="card-art" label={`Preview ${t.name}`}>
        <span className="card-plinth" style={{ background: t.theme.plinth }} aria-hidden="true" />
        {/* rendered from the real iPhone model by scripts/make-phone-renders.mjs */}
        <Image className="card-render" src={`/renders/${t.slug}.webp`} alt={`${t.name} invitation shown on two phones`} width={710} height={831} priority={priority} sizes="(max-width: 720px) 46vw, (max-width: 1039px) 30vw, 280px" />
      </PreviewButton>
      <div className="card-info">
        <p className="card-cat">{t.category}</p>
        <h3 className="card-name"><Link href={`/templates/${t.slug}`}>{t.name}</Link></h3>
        <p className="card-price"><Price /></p>
        <p className="card-blurb">{t.blurb}</p>
        <div className="card-actions">
          <PreviewButton slug={t.slug} className="btn btn-quiet btn-sm"><EyeIcon />Preview</PreviewButton>
          <CustomizeLink slug={t.slug} className="btn btn-solid btn-sm" />
        </div>
      </div>
    </article>
  );
}
