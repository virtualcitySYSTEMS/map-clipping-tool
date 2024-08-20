import { reactive, watch, type ShallowRef } from 'vue';
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
  EventType,
  SessionType,
  startEditFeaturesSession,
  startEditGeometrySession,
  TransformationMode,
} from '@vcmap/core';
import { unByKey } from 'ol/Observable.js';
import { EventsKey } from 'ol/events.js';
import { Coordinate } from 'ol/coordinate.js';
import type { ClippingToolObject } from './setup.js';
import type { CreateClippingFeatureSession } from './createClippingSession.js';
import { openWindowForClippingToolObject } from './windowHelper.js';
import EndEditorInteraction from './endEditorInteraction.js';

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
  modes: TransformationMode[],
): { actions: VcsAction[]; destroy: () => void } {
  const actions = new Map<TransformationMode, VcsAction>();

  modes.forEach((mode) => {
    actions.set(
      mode,
      reactive({
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
            editFeaturesSession.setFeatures([feature]);

            currentEditorSession.value = editFeaturesSession;

            const endEditorInteraction = new EndEditorInteraction(
              currentEditorSession,
            );
            const destroyEndEditorInteraction =
              app.maps.eventHandler.addPersistentInteraction(
                endEditorInteraction,
              );
            editFeaturesSession.stopped.addEventListener(() => {
              destroyEndEditorInteraction();
              endEditorInteraction.destroy();
              currentEditorSession.value = undefined;
            });
          }
        },
      }),
    );
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
  const action: VcsAction = reactive({
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

        currentEditorSession.value.setFeature(feature);
        openWindowForClippingToolObject(app, collectionComponent, feature);

        const endEditorInteraction = new EndEditorInteraction(
          currentEditorSession,
        );
        const destroyEndEditorInteraction =
          app.maps.eventHandler.addPersistentInteraction(endEditorInteraction);

        const geometry = feature.getGeometry();
        const cachedFeaturePickPosition =
          app.maps.eventHandler.featureInteraction.pickPosition;
        app.maps.eventHandler.featureInteraction.pickPosition = EventType.NONE;

        let geometryListenerKey: EventsKey;
        if (geometry) {
          const zValue = geometry?.getFlatCoordinates()[2];
          const ensureSameHeightHandler = (): void => {
            unByKey(geometryListenerKey);
            const coords = geometry.getCoordinates();
            if (geometry.getType() === 'LineString') {
              // makes sure vertices keep same z value when they are edited
              coords[0][2] = zValue;
              coords[1][2] = zValue;
            }
            geometry.setCoordinates(coords as Coordinate[] & Coordinate[][]);
            geometryListenerKey = geometry.on(
              'change',
              ensureSameHeightHandler,
            );
          };

          geometryListenerKey = geometry.on('change', ensureSameHeightHandler);
        }

        currentEditorSession.value.stopped.addEventListener(() => {
          currentEditorSession.value = undefined;
          destroyEndEditorInteraction();
          endEditorInteraction.destroy();
          unByKey(geometryListenerKey);
          app.maps.eventHandler.featureInteraction.pickPosition =
            cachedFeaturePickPosition;
        });
      }
    },
  });

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

export function createShowHideAction(feature: ClippingToolObject): {
  action: VcsAction;
  destroy: () => void;
} {
  const action: VcsAction = reactive({
    name: 'clippingTool.showFeature',
    title: 'clippingTool.showFeature',
    icon: '$vcsEye',
    active: feature.getProperty('showFeature'),
    callback: () => {
      const showFeature = !feature.getProperty('showFeature');
      feature.setProperties({ showFeature });
    },
  });

  const listener = feature.on('propertychange', ({ key }) => {
    if (key === 'showFeature') {
      action.active = feature.get(key);
    }
  });

  return {
    action,
    destroy(): void {
      unByKey(listener);
    },
  };
}
