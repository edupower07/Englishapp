import React from "react";
import { Composition } from "remotion";
import { V } from "./theme";
import { Main } from "./Main";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Main"
      component={Main}
      durationInFrames={V.durationInFrames}
      fps={V.fps}
      width={V.width}
      height={V.height}
    />
  </>
);
