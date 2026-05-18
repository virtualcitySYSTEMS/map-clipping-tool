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
import ConfigEditor, { getDefaultOptions } from './ConfigEditor.vue';
import type { ClippingType, ClippingToolObject } from './setup.js';
import {
  clippingObjectSymbol,
  createActiveClippingObjectRef,
  setupClippingFeatureLayer,
} from './setup.js';
import type { CreateClippingFeatureSession } from './createClippingSession.js';
import { startCreateClippingSession } from './createClippingSession.js';
import addContextMenu from './contextMenue.js';
import { createEditorWindowComponentOptions } from './windowHelper';

export type ClippingConfig = {
  horizontalExtrusionHeight?: number;
  verticalExtrusionHeight?: number;
  isInfinite?: boolean;
  cutsGlobe?: boolean;
  verticalRotation?: number;
};
type PluginState = Record<never, never>;

export type ClippingToolPlugin = VcsPlugin<ClippingConfig, PluginState> & {
  readonly config: Required<ClippingConfig>;
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
  openWindowForClippingToolObject(clippingToolObject: ClippingToolObject): void;
};

export default function plugin(options: ClippingConfig): ClippingToolPlugin {
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

  const config = {
    ...getDefaultOptions(),
    ...options,
  };

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
    get config(): Required<ClippingConfig> {
      return config;
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
        config,
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
    openWindowForClippingToolObject(
      clippingToolObject: ClippingToolObject,
    ): void {
      if (app?.windowManager.has(`${this.collectionComponent.id}-editor`)) {
        if (activeClippingToolObject?.value !== clippingToolObject) {
          app.windowManager.remove(`${this.collectionComponent.id}-editor`);
        } else {
          return;
        }
      }

      if (this.collectionComponent.collection.has(clippingToolObject)) {
        this.collectionComponent.selection.value = [
          this.collectionComponent.getListItemForItem(clippingToolObject)!,
        ];
        this.collectionComponent.openEditorWindow(clippingToolObject);
      } else {
        app!.windowManager.add(
          createEditorWindowComponentOptions(
            app!,
            clippingToolObject,
            `${this.collectionComponent.id}-editor`,
          ),
          name,
        );
      }
    },
    getDefaultOptions,
    toJSON(): ClippingConfig {
      const serial: ClippingConfig = {};
      const defaultOptions = getDefaultOptions();
      if (
        config.horizontalExtrusionHeight !==
        defaultOptions.horizontalExtrusionHeight
      ) {
        serial.horizontalExtrusionHeight = config.horizontalExtrusionHeight;
      }
      if (
        config.verticalExtrusionHeight !==
        defaultOptions.verticalExtrusionHeight
      ) {
        serial.verticalExtrusionHeight = config.verticalExtrusionHeight;
      }
      if (config.isInfinite !== defaultOptions.isInfinite) {
        serial.isInfinite = config.isInfinite;
      }
      if (config.cutsGlobe !== defaultOptions.cutsGlobe) {
        serial.cutsGlobe = config.cutsGlobe;
      }
      if (config.verticalRotation !== defaultOptions.verticalRotation) {
        serial.verticalRotation = config.verticalRotation;
      }
      return serial;
    },
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [
        {
          component: ConfigEditor,
          title: 'Clipping Tool Config Editor',
          infoUrlCallback: app?.getHelpUrlCallback(
            '/components/plugins/clippingToolConfig.html',
            'app-configurator',
          ),
        },
      ];
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
          create: 'Create clipping plane',
          createVertical: 'Create vertical clipping plane',
          createHorizontal: 'Create horizontal clipping plane',
          layerNames: 'Layer',
          createDescription: 'Set clipping skeleton by click within the map.',
          zoomTo: 'Zoom to item',
          export: 'Export',
          delete: 'Delete',
          config: {
            startupSettings: 'Startup settings',
            horizontalExtrusionHeight: 'Horizontal extrusion height',
            verticalExtrusionHeight: 'Vertical extrusion height',
            isInfinite: 'Is infinite',
            cutsGlobe: 'Cuts globe',
            verticalRotation: 'Vertical rotation',
            verticalRotationHelpText:
              'At 0°, the plane faces away from the camera; positive values rotate anti-clockwise.',
          },
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
          create: 'Schnittebene erzeugen',
          createVertical: 'Vertikalen Schnitt erzeugen',
          createHorizontal: 'Horizontalen Schnitt erzeugen',
          layerNames: 'Ebene',
          createDescription:
            'Setzen Sie die Schnittebene mit einem Klick in die Karte.',
          zoomTo: 'Auf Element zoomen',
          export: 'Exportieren',
          delete: 'Löschen',
          config: {
            startupSettings: 'Starteinstellungen',
            horizontalExtrusionHeight: 'Horizontale Extrusionshöhe',
            verticalExtrusionHeight: 'Vertikale Extrusionshöhe',
            isInfinite: 'Ist unendlich',
            cutsGlobe: 'Schneidet Globus',
            verticalRotation: 'Vertikale Rotation',
            verticalRotationHelpText:
              'Bei 0° zeigt die Ebene von der Kamera weg; positive Werte drehen gegen den Uhrzeigersinn.',
          },
        },
      },
    },
    destroy(): void {
      destroy();
    },
  };
}
