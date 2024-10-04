import {
  Category,
  CesiumMap,
  parseGeoJSON,
  writeGeoJSON,
  writeGeoJSONFeature,
} from '@vcmap/core';
import type {
  EditorCollectionComponentClass,
  MappingFunction,
  VcsAction,
  VcsUiApp,
} from '@vcmap/ui';
import {
  downloadText,
  importIntoLayer,
  createListExportAction,
  createListImportAction,
  createSupportedMapMappingFunction,
  makeEditorCollectionComponentClass,
  createZoomToFeatureAction,
} from '@vcmap/ui';
import type { ShallowRef } from 'vue';
import { reactive, watch } from 'vue';
import { unByKey } from 'ol/Observable.js';
import type Feature from 'ol/Feature.js';
import { name } from '../package.json';
import type {
  ClippingType,
  ClippingObjectProperties,
  ClippingToolObject,
} from './setup.js';
import { isValidClippingToolObject } from './setup.js';
import type { ClippingToolPlugin } from './index.js';
import { createEditorWindowComponentOptions } from './windowHelper.js';

class ClippingToolCategory extends Category<ClippingToolObject, object> {
  static get className(): string {
    return 'ClippingToolCategory';
  }

  // eslint-disable-next-line class-methods-use-this
  protected _serializeItem(item: ClippingToolObject): object {
    return writeGeoJSONFeature(item, {
      asObject: true,
      writeId: true,
    }) as object;
  }

  // eslint-disable-next-line class-methods-use-this
  protected _deserializeItem(config: object): Promise<ClippingToolObject> {
    const [item] = parseGeoJSON(config).features;
    if (isValidClippingToolObject(item)) {
      return Promise.resolve(item);
    }
    return Promise.reject(new Error('could not desierialize item'));
  }
}

export default ClippingToolCategory;

export function createTitleForClippingToolObject(
  clippingObjectType: ClippingType,
  persistedClippingToolObjects: ClippingToolObject[],
): string {
  let title: string | undefined;
  let count = 0;

  const sameTypeObjectNames = new Set(
    persistedClippingToolObjects
      .filter(
        (object) =>
          (object.get('clippingType') as ClippingType) === clippingObjectType,
      )
      .map((object) => object.get('title') as string),
  );

  do {
    count += 1;
    if (!sameTypeObjectNames.has(`${clippingObjectType}-${count}`)) {
      title = `${clippingObjectType}-${count}`;
    }
  } while (!title);

  return title;
}

function createVisibilityAction(
  item: ClippingToolObject,
  activeItem: ShallowRef<ClippingToolObject | undefined>,
): { action: VcsAction; destroy: () => void } {
  const action: VcsAction = reactive({
    name: 'visibilityAction',
    icon: '$vcsCheckbox',
    callback(): void {
      if (item === activeItem.value) {
        activeItem.value = undefined;
      } else {
        activeItem.value = item;
      }
    },
  });

  const destroy = watch(
    activeItem,
    () => {
      action.icon =
        activeItem.value === item ? '$vcsCheckboxChecked' : '$vcsCheckbox';
    },
    { immediate: true },
  );

  return { action, destroy };
}

export async function createCategory(
  app: VcsUiApp,
  plugin: ClippingToolPlugin,
): Promise<{
  collectionComponent: EditorCollectionComponentClass<ClippingToolObject>;
  destroy: () => void;
}> {
  const { collectionComponent } =
    await app.categoryManager.requestCategory<ClippingToolObject>(
      {
        type: ClippingToolCategory.className,
        name: 'ClippingTool',
        title: 'clippingTool.clippingPlanes',
        keyProperty: 'id_' as keyof ClippingToolObject,
      },
      name,
      {
        selectable: true,
        renamable: true,
        removable: true,
      },
    );

  collectionComponent.addItemMapping({
    mappingFunction: createSupportedMapMappingFunction(
      [CesiumMap.className],
      app.maps,
    ),
    owner: name,
  });

  const itemMappingFunction: MappingFunction<ClippingToolObject> = (
    item,
    _c,
    listItem,
  ) => {
    const props = item.getProperties() as ClippingObjectProperties;
    listItem.title = props.title;

    listItem.titleChanged = (title: string): void => {
      item.set('title', title);
      listItem.title = title;
    };

    const { action: visibilityAction, destroy } = createVisibilityAction(
      item,
      plugin.activeClippingToolObject,
    );

    const zoomAction = createZoomToFeatureAction(
      { name: 'clippingTool.zoomTo' },
      item,
      app.maps,
    );
    if (zoomAction) {
      listItem.actions.push();
    }

    listItem.actions.push(visibilityAction);
    listItem.destroyFunctions.push(destroy);
  };

  app.categoryManager.addMappingFunction(
    () => true,
    itemMappingFunction,
    name,
    [collectionComponent.id],
  );

  const { action: exportAction, destroy: destroyExportAction } =
    createListExportAction(
      collectionComponent.selection,
      () => {
        const features = collectionComponent.selection.value
          .map((item) => collectionComponent.collection.getByKey(item.name))
          .filter((object): object is ClippingToolObject => !!object);

        const text = writeGeoJSON({ features }, { prettyPrint: true });
        if (typeof text === 'string') {
          downloadText(text, 'clippings.json');
        }
      },
      name,
    );

  const { action: importAction, destroy: destroyImportAction } =
    createListImportAction(
      async (files) => {
        const newFeatures: Feature[] = [];
        const layerListener = plugin.clippingFeatureLayer
          .getSource()
          .on('addfeature', ({ feature }) => {
            newFeatures.push(feature as Feature);
          });

        const imported = await importIntoLayer(
          files,
          app,
          plugin.clippingFeatureLayer,
          {
            predicate: isValidClippingToolObject,
          },
        );
        if (imported) {
          newFeatures.forEach((f) => {
            if (plugin.clippingFeatureLayer.getFeatureById(f.getId()!)) {
              plugin.collectionComponent.collection.add(
                f as ClippingToolObject,
              );
            }
          });
        }
        unByKey(layerListener);
        return imported;
      },
      app.windowManager,
      name,
      'category-manager',
    );

  collectionComponent.addActions([exportAction, importAction]);

  const editorCollectionComponent = makeEditorCollectionComponentClass(
    app,
    collectionComponent,
    {
      editor: (item) => createEditorWindowComponentOptions(app, item),
    },
  );

  return {
    collectionComponent: editorCollectionComponent,
    destroy(): void {
      destroyExportAction();
      destroyImportAction();
    },
  };
}
