import { watch, type ShallowRef } from 'vue';
import type {
  EditorCollectionComponentClass,
  VcsAction,
  VcsUiApp,
} from '@vcmap/ui';
import { EditorTransformationIcons } from '@vcmap/ui';
import type {
  EditFeaturesSession,
  EditGeometrySession,
  VectorLayer,
} from '@vcmap/core';
import {
  SessionType,
  startEditFeaturesSession,
  startEditGeometrySession,
  TransformationMode,
} from '@vcmap/core';
import type { ClippingToolObject } from './setup.js';
import type { CreateClippingFeatureSession } from './createClippingSession.js';
import { openWindowForClippingToolObject } from './windowHelper.js';

export function createTransformationActions(
  app: VcsUiApp,
  collectionComponent: EditorCollectionComponentClass<ClippingToolObject>,
  layer: VectorLayer,
  feature: ClippingToolObject,
  currentEditorSession: ShallowRef<
    | CreateClippingFeatureSession
    | EditGeometrySession
    | EditFeaturesSession
    | undefined
  >,
): { actions: VcsAction[]; destroy: () => void } {
  const actions = new Map<TransformationMode, VcsAction>();

  [
    TransformationMode.TRANSLATE,
    TransformationMode.ROTATE,
    TransformationMode.SCALE,
  ].forEach((mode) => {
    actions.set(mode, {
      name: `components.editor.${mode}`,
      title: `components.editor.${mode}`,
      icon: EditorTransformationIcons[mode],
      active: false,
      callback: (): void => {
        if (currentEditorSession.value?.type === SessionType.EDIT_FEATURES) {
          if (currentEditorSession.value.mode === mode) {
            currentEditorSession.value.stop();
          } else {
            currentEditorSession.value.setMode(mode);
          }
        } else {
          openWindowForClippingToolObject(app, collectionComponent, feature);
          const editFeaturesSession = startEditFeaturesSession(
            app,
            layer,
            undefined,
            mode,
          );
          editFeaturesSession.stopped.addEventListener(() => {
            currentEditorSession.value = undefined;
          });
          editFeaturesSession.setFeatures([feature]);

          currentEditorSession.value = editFeaturesSession;
        }
      },
    });
  });

  const sessionWatcher = watch(
    currentEditorSession,
    (editorSession) => {
      function setActionActive(mode?: TransformationMode): void {
        actions.forEach((action, key) => {
          action.active = key === mode;
        });
      }

      if (editorSession?.type === SessionType.EDIT_FEATURES) {
        setActionActive(editorSession.mode);
        editorSession.modeChanged.addEventListener(setActionActive);
      } else {
        setActionActive();
      }
    },
    { immediate: true },
  );

  return {
    actions: [...actions.values()],
    destroy(): void {
      sessionWatcher();
    },
  };
}

export function createEditAction(
  app: VcsUiApp,
  collectionComponent: EditorCollectionComponentClass<ClippingToolObject>,
  layer: VectorLayer,
  feature: ClippingToolObject,
  currentEditorSession: ShallowRef<
    | CreateClippingFeatureSession
    | EditGeometrySession
    | EditFeaturesSession
    | undefined
  >,
): { action: VcsAction; destroy: () => void } {
  const action: VcsAction = {
    name: 'components.editor.edit',
    title: 'components.editor.edit',
    icon: '$vcsEditVertices',
    active: false,
    callback: () => {
      if (currentEditorSession.value?.type === SessionType.EDIT_GEOMETRY) {
        currentEditorSession.value.stop();
      } else {
        currentEditorSession.value = startEditGeometrySession(
          app,
          layer,
          undefined,
          {
            denyInsertion: true,
            denyRemoval: true,
          },
        );
        currentEditorSession.value.stopped.addEventListener(() => {
          currentEditorSession.value = undefined;
        });
        currentEditorSession.value.setFeature(feature);
        openWindowForClippingToolObject(app, collectionComponent, feature);
      }
    },
  };

  const sessionWatcher = watch(
    currentEditorSession,
    (editorSession) => {
      action.active = editorSession?.type === SessionType.EDIT_GEOMETRY;
    },
    { immediate: true },
  );

  return {
    action,
    destroy(): void {
      sessionWatcher();
    },
  };
}
