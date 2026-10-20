"use client";
import { Status } from "@/components/ui";

export function BrollPanel() {
  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">B-roll</h3>
      <Status kind="not-implemented">
        B-roll insertion is not built yet. The plan: suggest search keywords from the transcript, query an authorised stock library through a server-side API key (e.g. Pexels or Pixabay - their licences allow free use with attribution rules), preview clips, and insert them as an overlay track with timing and crop. Footage is never downloaded without a licence. You can already add your own footage later through the same asset pipeline.
      </Status>
    </div>
  );
}

export function TransitionsPanel() {
  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Transitions</h3>
      <Status kind="not-implemented">
        Transitions between cut segments are not built. Cuts are currently hard cuts (the audio and video of adjacent segments are frame-aligned). The Remotion transitions package is installed and is the planned basis.
      </Status>
    </div>
  );
}
