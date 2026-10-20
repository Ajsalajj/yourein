"use client";
import { useEditor } from "@/store/editor";
import { TemplateGallery } from "@/components/TemplateGallery";
import { getTemplate } from "@/remotion/templates/registry";
import { Button } from "@/components/ui";

export function TemplatesPanel() {
  const templateId = useEditor((s) => s.project!.captionStyle.templateId);
  const selected = useEditor((s) => s.selection.captionId);
  const apply = useEditor((s) => s.applyTemplate);
  return (
    <div className="space-y-3 p-4">
      <p className="text-[12px] text-mute">Click a template to apply it to <b>all captions</b>; the preview updates immediately. Current: <b className="text-text">{getTemplate(templateId).name}</b></p>
      {selected ? (
        <p className="rounded-md bg-panel-2 p-2 text-[11px] text-mute">A caption is selected - use “Selected caption” in the right panel to give just that caption its own template.</p>
      ) : null}
      <TemplateGallery activeId={templateId} onPick={(t) => apply(t.id)} columns="grid-cols-2" />
      <Button size="sm" variant="ghost" onClick={() => apply(templateId)}>Reset style overrides</Button>
    </div>
  );
}
