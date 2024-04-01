import { nextTick, watch } from 'vue';
import type { EditorSession } from '@vcmap/core';
import { cursorMap, SessionType, VcsEvent } from '@vcmap/core';
import type { VcsUiApp } from '@vcmap/ui';
import type Feature from 'ol/Feature.js';
import ClippingToolInteraction from './clippingToolInteraction.js';
import type { ClippingToolPlugin } from './index.js';
import type { ClippingType, ClippingToolObject } from './setup.js';
import { createEditorWindowComponentOptions } from './windowHelper.js';
import { name } from '../package.json';

export type CreateClippingFeatureSession = EditorSession<SessionType.CREATE> & {
  clippingType: ClippingType;
};

export async function startCreateClippingSession(
  app: VcsUiApp,
  type: ClippingType,
  plugin: ClippingToolPlugin,
  windowId: string,
): Promise<CreateClippingFeatureSession> {
  plugin.activeClippingToolObject.value = undefined;
  await nextTick();
  const stopped = new VcsEvent<void>();
  const isVertical = type === 'vertical';
  const interaction = new ClippingToolInteraction(isVertical);

  if (!app.windowManager.has(windowId)) {
    app.windowManager.add(
      createEditorWindowComponentOptions(app, undefined, windowId),
      name,
    );
  }

  let stop = (_obj?: Feature): void => {};
  const listener = app.maps.eventHandler.addExclusiveInteraction(
    interaction,
    () => {
      stop();
    },
  );

  if (app.maps.target) {
    app.maps.target.style.cursor = cursorMap.select;
  }

  const removeInteraction = (): void => {
    listener();
    interaction.destroy();
    if (app.maps.target) {
      app.maps.target.style.cursor = cursorMap.auto;
    }
  };

  let activeClippingToolObjectListener = (): void => {};
  stop = (obj?: Feature): void => {
    activeClippingToolObjectListener();
    removeInteraction();
    if (obj) {
      plugin.clippingFeatureLayer.addFeatures([obj]);
      plugin.activeClippingToolObject.value = obj as ClippingToolObject;
    }
    plugin.editorSession.value = undefined;
    stopped.raiseEvent();
  };

  activeClippingToolObjectListener = watch(
    plugin.activeClippingToolObject,
    () => {
      stop();
    },
  );

  interaction.finished.addEventListener((feature) => {
    removeInteraction();
    stop(feature);
  });

  return {
    clippingType: type,
    type: SessionType.CREATE,
    stopped,
    stop(): void {
      stop();
    },
  };
}
