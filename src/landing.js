import { createIntro } from "./intro.js";

const State = Object.freeze({ INTRO: 0, BROWSE: 1 });

export function createLanding(camera, controls, projectSlider, model, grid) {
  let state = State.INTRO;
  const intro = createIntro(camera, controls, projectSlider, model, grid);
  let onStateChangeCb = null;

  function onIntroComplete() {
    state = State.BROWSE;
    if (onStateChangeCb) onStateChangeCb("browse");
  }

  function start() {
    projectSlider.setScrollEnabled(false);
    intro.start(onIntroComplete);
  }

  function getState() { return state; }

  function destroy() {
    intro.destroy();
    projectSlider.setAmbientSpeed(0);
    projectSlider.setScrollEnabled(true);
    state = State.BROWSE;
  }

  return { start, getState, destroy, setOnStateChange: (cb) => { onStateChangeCb = cb; }, introTiming: intro.introTiming };
}
