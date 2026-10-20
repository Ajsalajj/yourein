import React from "react";
import { Composition } from "remotion";
import { Studio, type StudioProps } from "./Studio";
import { getCompositionMeta } from "../lib/composition";
import { newProject } from "../lib/project";

const defaults: StudioProps = { project: newProject({ id: "default0000", name: "default" }), mediaUrls: {} };

export const Root: React.FC = () => (
  <Composition
    id="Studio"
    component={Studio}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={defaults}
    calculateMetadata={({ props }) => {
      const m = getCompositionMeta(props.project);
      return { width: m.width, height: m.height, fps: m.fps, durationInFrames: m.durationInFrames };
    }}
  />
);
