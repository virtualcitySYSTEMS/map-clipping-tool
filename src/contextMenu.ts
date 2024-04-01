import { downloadText, type VcsAction, type VcsUiApp } from '@vcmap/ui';
import type { InteractionEvent } from '@vcmap/core';
import {
  CesiumMap,
  createClippingFeature,
  Projection,
  writeGeoJSON,
} from '@vcmap/core';
import { nextTick } from 'vue';
import type { ClippingToolPlugin } from './index.js';
import { name } from '../package.json';
import { createEditAction, createTransformationActions } from './actions.js';
import type { ClippingToolObject } from './setup.js';
import { createEditorWindowComponentOptions } from './windowHelper.js';

export default function addContextMenu(
  app: VcsUiApp,
  plugin: ClippingToolPlugin,
): () => void {
  let destroyActions: () => void = () => {};

  app.contextMenuManager.closed.addEventListener(() => {
    destroyActions();
    destroyActions = (): void => {};
  });

  function clippingHandler(event: InteractionEvent): VcsAction[] {
    const contextEntries: VcsAction[] = [];
    const {
      clippingFeatureLayer,
      activeClippingToolObject,
      collectionComponent,
      editorSession,
    } = plugin;
    if (
      event.feature &&
      activeClippingToolObject.value &&
      event.feature === activeClippingToolObject.value
    ) {
      const { action: editAction, destroy: destroyEditAction } =
        createEditAction(
          app,
          collectionComponent,
          clippingFeatureLayer,
          activeClippingToolObject.value,
          editorSession,
        );
      const {
        actions: transformationActions,
        destroy: destroyTransformationActions,
      } = createTransformationActions(
        app,
        collectionComponent,
        clippingFeatureLayer,
        activeClippingToolObject.value,
        editorSession,
      );

      destroyActions = (): void => {
        destroyEditAction();
        destroyTransformationActions();
      };

      contextEntries.push(editAction);
      contextEntries.push(...transformationActions);
      contextEntries.push({
        name: 'clippingTool.export',
        title: 'clippingTool.export',
        icon: '$vcsExport',
        callback: (): void => {
          if (activeClippingToolObject.value) {
            const text = writeGeoJSON(
              { features: [activeClippingToolObject.value] },
              { prettyPrint: true },
            );
            if (typeof text === 'string') {
              const title =
                activeClippingToolObject.value.getProperty('title') ??
                'tempClipping';
              downloadText(text, `${title}.json`);
            }
          }
        },
      });

      contextEntries.push({
        name: 'clippingTool.delete',
        title: 'clippingTool.delete',
        icon: '$vcsTrashCan',
        callback: (): void => {
          if (
            activeClippingToolObject.value &&
            clippingFeatureLayer.getFeatureById(
              activeClippingToolObject.value.getId()!,
            )
          ) {
            collectionComponent.collection.remove(
              activeClippingToolObject.value,
            );
          }
          activeClippingToolObject.value = undefined;
        },
      });
    } else if (event.position && app.maps.activeMap instanceof CesiumMap) {
      contextEntries.push(
        ...['horizontal', 'vertical'].map((clippingType) => {
          const capitalizedType =
            clippingType.charAt(0).toUpperCase() + clippingType.slice(1);
          return {
            name: `clippingTool.create${capitalizedType}`,
            icon: `$vcsClipping${capitalizedType}`,
            callback: async (): Promise<void> => {
              if (event.position) {
                const camera = (event.map as CesiumMap).getScene()?.camera;
                const coordinate = Projection.mercatorToWgs84(event.position);
                if (camera) {
                  plugin.activeClippingToolObject.value = undefined;
                  await nextTick();

                  if (
                    !app.windowManager.has(`${collectionComponent.id}-editor`)
                  ) {
                    app.windowManager.add(
                      createEditorWindowComponentOptions(
                        app,
                        undefined,
                        `${collectionComponent.id}-editor`,
                      ),
                      name,
                    );
                  }
                  const feature = createClippingFeature(
                    coordinate,
                    camera,
                    clippingType === 'vertical',
                  ) as ClippingToolObject;
                  plugin.clippingFeatureLayer.addFeatures([feature]);
                  plugin.activeClippingToolObject.value = feature;
                }
              }
            },
          };
        }),
      );
    }
    return contextEntries;
  }

  app.contextMenuManager.addEventHandler(clippingHandler, name);

  return (): void => {
    destroyActions();
    app.contextMenuManager.removeHandler(clippingHandler);
  };
}
