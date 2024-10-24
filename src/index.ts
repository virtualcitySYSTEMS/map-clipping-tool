import type {
  VcsPlugin,
  VcsUiApp,
  PluginConfigEditor,
  EditorCollectionComponentClass,
} from '@vcmap/ui';
import type { ShallowRef } from 'vue';
import { shallowRef } from 'vue';
import type {
  EditFeaturesSession,
  EditGeometrySession,
  VectorLayer,
} from '@vcmap/core';
import { moduleIdSymbol } from '@vcmap/core';
import { name, version, mapVersion } from '../package.json';
import addClippingToolButtons from './toolboxHelper.js';
import ClippingToolCategory, {
  createCategory,
} from './clippingToolCategory.js';
import type { ClippingType, ClippingToolObject } from './setup.js';
import {
  clippingObjectSymbol,
  createActiveClippingObjectRef,
  setupClippingFeatureLayer,
} from './setup.js';
import type { CreateClippingFeatureSession } from './createClippingSession.js';
import { startCreateClippingSession } from './createClippingSession.js';
import addContextMenu from './contextMenue.js';

type PluginConfig = Record<never, never>;
type PluginState = Record<never, never>;

export type ClippingToolPlugin = VcsPlugin<PluginConfig, PluginState> & {
  readonly clippingFeatureLayer: VectorLayer;
  readonly collectionComponent: EditorCollectionComponentClass<ClippingToolObject>;
  readonly activeClippingToolObject: ShallowRef<ClippingToolObject | undefined>;
  readonly editorSession: ShallowRef<
    | CreateClippingFeatureSession
    | EditGeometrySession
    | EditFeaturesSession
    | undefined
  >;
  startCreateClippingSession(
    this: ClippingToolPlugin,
    type: ClippingType,
  ): Promise<void>;
};

export default function plugin(): ClippingToolPlugin {
  let collectionComponent:
    | EditorCollectionComponentClass<ClippingToolObject>
    | undefined;
  let app: VcsUiApp | undefined;
  let clippingFeatureLayer: VectorLayer | undefined;
  let activeClippingToolObject:
    | ShallowRef<ClippingToolObject | undefined>
    | undefined;
  const editorSession: ShallowRef<
    | CreateClippingFeatureSession
    | EditGeometrySession
    | EditFeaturesSession
    | undefined
  > = shallowRef(undefined);
  let destroy = (): void => {};

  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    get activeClippingToolObject(): ShallowRef<ClippingToolObject | undefined> {
      if (!activeClippingToolObject) {
        throw new Error('Clipping tool not yet initialized');
      }
      return activeClippingToolObject;
    },
    get clippingFeatureLayer(): VectorLayer {
      if (!clippingFeatureLayer) {
        throw new Error('Clipping tool not yet initialized');
      }
      return clippingFeatureLayer;
    },
    get editorSession(): ShallowRef<
      | CreateClippingFeatureSession
      | EditGeometrySession
      | EditFeaturesSession
      | undefined
    > {
      return editorSession;
    },
    get collectionComponent(): EditorCollectionComponentClass<ClippingToolObject> {
      if (!collectionComponent) {
        throw new Error('Clipping tool not yet initialized');
      }
      return collectionComponent;
    },
    async initialize(vcsUiApp: VcsUiApp): Promise<void> {
      app = vcsUiApp;
      app.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        ClippingToolCategory.className,
        ClippingToolCategory,
      );
      const clippingToolCategoryHelper = await createCategory(vcsUiApp, this);
      ({ collectionComponent } = clippingToolCategoryHelper);
      const layer = await setupClippingFeatureLayer(
        vcsUiApp,
        clippingToolCategoryHelper.collectionComponent.collection,
      );
      clippingFeatureLayer = layer.layer;
      const activeRef = createActiveClippingObjectRef(
        vcsUiApp,
        collectionComponent,
        clippingFeatureLayer,
      );
      ({ activeClippingToolObject } = activeRef);

      const destroyClippingToolBox = addClippingToolButtons(
        vcsUiApp,
        name,
        `${clippingToolCategoryHelper.collectionComponent.id}-editor`,
        this,
      );
      const destroyContextMenu = addContextMenu(app, this);
      destroy = (): void => {
        activeRef.destroy();
        clippingToolCategoryHelper.destroy();
        destroyClippingToolBox();
        destroyContextMenu();
        layer.destroy();
        const clippingObject =
          activeClippingToolObject?.value?.[clippingObjectSymbol];
        if (
          clippingObject &&
          vcsUiApp.maps.clippingObjectManager.hasClippingObject(clippingObject)
        ) {
          vcsUiApp.maps.clippingObjectManager.clearExclusiveClippingObjects();
        }
      };
      return Promise.resolve();
    },
    async startCreateClippingSession(type: ClippingType): Promise<void> {
      editorSession.value = await startCreateClippingSession(
        app!,
        type,
        this,
        `${this.collectionComponent.id}-editor`,
      );
    },
    getDefaultOptions(): PluginConfig {
      return {};
    },
    toJSON(): PluginConfig {
      return {};
    },
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [];
    },
    i18n: {
      en: {
        clippingTool: {
          clippingPlanes: 'Clipping Planes',
          clippingPlane: 'Clipping Plane',
          temporary: 'Temporary',
          horizontal: 'Horizontal',
          vertical: 'Vertical',
          isInfinite: 'Is infinite',
          cutsGlobe: 'Cuts globe',
          isInverted: 'Is inverted',
          showFeature: 'Show feature',
          new: 'New',
          addToMyWorkspace: 'Add to My Workspace',
          create: 'Create',
          createVertical: 'Create vertical clipping plane',
          createHorizontal: 'Create horizontal clipping plane',
          layerNames: 'Layer',
          createDescription: 'Set clipping skeleton by click within the map.',
          zoomTo: 'Zoom to item',
          export: 'Export',
          delete: 'Delete',
        },
      },
      de: {
        clippingTool: {
          clippingPlanes: 'Schnittebenen',
          clippingPlane: 'Schnittebene',
          temporary: 'Temporäre',
          horizontal: 'Horizontale',
          vertical: 'Vertikale',
          isInfinite: 'Unendlich',
          cutsGlobe: 'Schneidet Globus',
          isInverted: 'Invertieren',
          showFeature: 'Feature anzeigen',
          new: 'Neu',
          addToMyWorkspace: 'Zu Mein Arbeitsbereich hinzufügen',
          create: 'Erzeuge',
          createVertical: 'Erzeuge vertikale Schnittebene',
          createHorizontal: 'Erzeuge horizontale Schnittebene',
          layerNames: 'Ebene',
          createDescription:
            'Setzen Sie die Schnittebene mit einem Klick in die Karte.',
          zoomTo: 'Auf Element zoomen',
          export: 'Exportieren',
          delete: 'Löschen',
        },
      },
    },
    destroy(): void {
      destroy();
    },
  };
}
