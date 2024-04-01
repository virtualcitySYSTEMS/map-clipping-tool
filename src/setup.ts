import { getLogger } from '@vcsuite/logger';
import type { ClippingPlaneCollection } from '@vcmap-cesium/engine';
import type { ShallowRef } from 'vue';
import { shallowRef, watch } from 'vue';
import { unByKey } from 'ol/Observable.js';
import type Feature from 'ol/Feature';
import type { LineString, Polygon } from 'ol/geom';
import type { Collection } from '@vcmap/core';
import {
  CesiumMap,
  CesiumTilesetLayer,
  ClippingObject,
  createClippingPlaneCollection,
  emptyStyle,
  getClippingOptions,
  getDefaultHighlightStyle,
  markVolatile,
  mercatorProjection,
  moduleIdSymbol,
  VectorLayer,
} from '@vcmap/core';
import type { CollectionComponentClass, VcsUiApp } from '@vcmap/ui';
import type Geometry from 'ol/geom/Geometry';
import { name } from '../package.json';

export type ClippingType = 'vertical' | 'horizontal';

export type ClippingObjectProperties = {
  title: string;
  clippingType: ClippingType;
  isInverted: boolean;
  isInfinite: boolean;
  showFeature: boolean;
  layerNames: string[];
  cutsGlobe: boolean;
  olcs_extrudedHeight?: number;
};

export const clippingObjectSymbol = Symbol('ClippingObject');
export type ClippingToolObject = Feature<LineString | Polygon> & {
  [moduleIdSymbol]: string;
  [clippingObjectSymbol]: ClippingObject;
};

export function isValidClippingToolObject(
  feature?: Feature,
): feature is ClippingToolObject {
  function isValidLineString(geometry: Geometry): boolean {
    return (
      geometry.getType() === 'LineString' &&
      geometry.getCoordinates().length === 2
    );
  }

  function isValidPolygon(geometry: Geometry): boolean {
    return (
      geometry.getType() === 'Polygon' &&
      geometry.getCoordinates()[0].length === 4
    );
  }

  const geometry = feature?.getGeometry();
  return (
    !!geometry && (isValidLineString(geometry) || isValidPolygon(geometry))
  );
}

function clippingPlaneCollectionFromFeature(
  f: ClippingToolObject,
): ClippingPlaneCollection | null {
  const props = f.getProperties() as ClippingObjectProperties;
  const clippingOptions = getClippingOptions(f, props.isInfinite);
  if (props.clippingType === 'horizontal' && props.olcs_extrudedHeight) {
    clippingOptions.createTopPlane = true;
  }
  clippingOptions.reverse = props.isInverted;

  return createClippingPlaneCollection(f, clippingOptions);
}

function createClippingObject(f: ClippingToolObject): ClippingObject {
  const clippingPlaneCollection = clippingPlaneCollectionFromFeature(f);
  if (clippingPlaneCollection) {
    const props = f.getProperties() as ClippingObjectProperties;
    return new ClippingObject({
      clippingPlaneCollection,
      layerNames: props.layerNames,
      terrain: props.cutsGlobe,
    });
  } else {
    throw new Error('Could not create clipping plane collection');
  }
}

function addFeatureListeners(f: ClippingToolObject): () => void {
  const updateClippingObject = (): void => {
    const collection = clippingPlaneCollectionFromFeature(f);
    if (collection) {
      f[clippingObjectSymbol].clippingPlaneCollection = collection;
    }
  };

  const geometryChangedListener = f
    .getGeometry()!
    .on('change', updateClippingObject);

  const propertyChangedListener = f.on('propertychange', (event) => {
    const { key } = event;
    if (
      key === 'isInverted' ||
      key === 'isInfinite' ||
      key === 'olcs_extrudedHeight'
    ) {
      updateClippingObject();
    } else if (key === 'cutsGlobe') {
      f[clippingObjectSymbol].terrain = !!f.get('cutsGlobe');
    } else if (key === 'layerNames') {
      const currentLayerNames = event.oldValue as string[];
      const toRemove = new Set(currentLayerNames);
      const value = f.get('layerNames') as string[];
      const clippingObject = f[clippingObjectSymbol];
      value.forEach((layerName) => {
        if (currentLayerNames.includes(layerName)) {
          toRemove.delete(layerName);
        } else {
          clippingObject.addLayer(layerName);
        }
      });
      toRemove.forEach((layerName) => clippingObject.removeLayer(layerName));
    }
  });

  return () => {
    unByKey(geometryChangedListener);
    unByKey(propertyChangedListener);
  };
}

export async function setupClippingFeatureLayer(
  app: VcsUiApp,
  collection: Collection<ClippingToolObject>,
): Promise<{ destroy: () => void; layer: VectorLayer }> {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
  });
  markVolatile(layer);
  layer.setStyle(emptyStyle);
  await layer.activate();
  app.layers.add(layer);
  const featureListeners = new Map<ClippingToolObject, () => void>();
  const source = layer.getSource();
  const layerListeners = [
    source.on('addfeature', ({ feature: f }) => {
      if (!isValidClippingToolObject(f)) {
        if (f) {
          layer.removeFeaturesById([f.getId()!]);
        }
        return;
      }
      f[moduleIdSymbol] = app.dynamicModuleId;

      let props = f.getProperties() as ClippingObjectProperties;
      if (!props.clippingType) {
        const clippingType =
          f.getGeometry()!.getType() === 'LineString'
            ? 'vertical'
            : 'horizontal';

        const layerNames: string[] = [...app.layers]
          .filter((l) => l.active && l instanceof CesiumTilesetLayer)
          .map((l) => l.name);

        props = {
          title: clippingType,
          clippingType,
          isInverted: false,
          isInfinite: false,
          showFeature: true,
          layerNames,
          cutsGlobe: false,
        };
        f.setProperties(props);
      }
      f[clippingObjectSymbol] = createClippingObject(f);
      featureListeners.set(f, addFeatureListeners(f));
    }),
    source.on('removefeature', ({ feature: f }) => {
      if (f) {
        featureListeners.get(f as ClippingToolObject)?.();
        featureListeners.delete(f as ClippingToolObject);
      }
    }),
  ];

  const collectionListeners = [
    collection.added.addEventListener((feature) => {
      if (!isValidClippingToolObject(feature)) {
        getLogger(name).error('Found invalid feature in collection, removing');
        collection.remove(feature);
      } else if (!layer.getFeatureById(feature.getId()!)) {
        layer.addFeatures([feature]);
      }
    }),
    collection.removed.addEventListener((feature) => {
      layer.removeFeaturesById([feature.getId()!]);
    }),
  ];

  return {
    layer,
    destroy: (): void => {
      unByKey(layerListeners);
      featureListeners.forEach((cb) => cb());
      featureListeners.clear();
      collectionListeners.forEach((cb) => cb());
    },
  };
}

const highlightStyle = getDefaultHighlightStyle();
export function createActiveClippingObjectRef(
  app: VcsUiApp,
  collectionComponent: CollectionComponentClass<ClippingToolObject>,
  layer: VectorLayer,
): {
  activeClippingToolObject: ShallowRef<ClippingToolObject | undefined>;
  destroy: () => void;
} {
  const activeClippingToolObject = shallowRef<ClippingToolObject | undefined>();
  const { clippingObjectManager } = app.maps;
  let removeShowFeatureListener = (): void => {};
  const activeWatcher = watch(activeClippingToolObject, (current, previous) => {
    removeShowFeatureListener();
    if (previous) {
      if (
        clippingObjectManager.hasClippingObject(previous[clippingObjectSymbol])
      ) {
        clippingObjectManager.clearExclusiveClippingObjects(true);
      }
      previous.setStyle();

      if (collectionComponent.collection.has(previous)) {
        const listItem = collectionComponent.getListItemForItem(previous);
        if (
          listItem &&
          collectionComponent.selection.value.includes(listItem) &&
          collectionComponent.selection.value.length === 1
        ) {
          collectionComponent.selection.value = [];
        }
      } else {
        layer.removeFeaturesById([previous.getId()!]);
      }
    }
    if (current) {
      if (app.maps.activeMap instanceof CesiumMap) {
        clippingObjectManager.setExclusiveClippingObjects(
          [current[clippingObjectSymbol]],
          () => {
            activeClippingToolObject.value = undefined;
          },
        );

        if (current.get('showFeature')) {
          current.setStyle(highlightStyle);
        }
        const featureChanged = current.on('propertychange', ({ key }) => {
          if (key === 'showFeature') {
            const show = current.get('showFeature') as boolean;
            if (show) {
              current.setStyle(highlightStyle);
            } else {
              current.setStyle();
            }
          }
        });
        removeShowFeatureListener = (): void => {
          unByKey(featureChanged);
        };
      }
    }
  });

  const selectionWatcher = watch(collectionComponent.selection, () => {
    if (
      collectionComponent.selection.value.length > 1 &&
      activeClippingToolObject.value
    ) {
      activeClippingToolObject.value = undefined;
    }
  });

  const removedListener =
    collectionComponent.collection.removed.addEventListener((removed) => {
      if (activeClippingToolObject.value === removed) {
        activeClippingToolObject.value = undefined;
      }
    });

  const mapWatcher = app.maps.mapActivated.addEventListener((map) => {
    if (!(map instanceof CesiumMap) && activeClippingToolObject.value) {
      const windowId = `${collectionComponent.id}-editor`;
      if (app.windowManager.has(windowId)) {
        app.windowManager.remove(windowId);
      }
      activeClippingToolObject.value = undefined;
    }
  });

  return {
    activeClippingToolObject,
    destroy(): void {
      removedListener();
      activeWatcher();
      selectionWatcher();
      mapWatcher();
    },
  };
}
