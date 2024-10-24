import type {
  EditorCollectionComponentClass,
  VcsUiApp,
  WindowComponentOptions,
} from '@vcmap/ui';
import { WindowSlot } from '@vcmap/ui';
import type { ClippingToolPlugin } from './index.js';
import { name } from '../package.json';
import ClippingToolWindow from './ClippingToolWindow.vue';
import type { ClippingType, ClippingToolObject } from './setup.js';

export const ClippingToolIcons: Record<ClippingType, string> = {
  horizontal: '$vcsClippingHorizontal',
  vertical: '$vcsClippingVertical',
};

const WINDOW_WIDTH = '280px';
const WINDOW_HEIGHT = 'auto';
const INFO_URL = 'tools/clippingTool.html';

export function createEditorWindowComponentOptions(
  app: VcsUiApp,
  item?: ClippingToolObject,
  windowId?: string,
): WindowComponentOptions {
  return {
    id: windowId,
    component: ClippingToolWindow,
    parentId: 'category-manager',
    slot: WindowSlot.DYNAMIC_CHILD,
    state: {
      headerTitle: (item?.get('title') as string) ?? 'clippingTool.create',
      headerIcon: ClippingToolIcons[item?.get('clippingType') as ClippingType],
      styles: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
      infoUrlCallback: app.getHelpUrlCallback(INFO_URL),
    },
    props: {
      featureId: item?.getId(),
    },
  };
}

export function openWindowForClippingToolObject(
  app: VcsUiApp,
  collectionComponent: EditorCollectionComponentClass<ClippingToolObject>,
  clippingToolObject: ClippingToolObject,
): void {
  const { activeClippingToolObject } = app.plugins.getByKey(
    '@vcmap/clipping-tool',
  ) as ClippingToolPlugin;
  if (app.windowManager.has(`${collectionComponent.id}-editor`)) {
    if (activeClippingToolObject.value !== clippingToolObject) {
      app.windowManager.remove(`${collectionComponent.id}-editor`);
    } else {
      return;
    }
  }

  if (collectionComponent.collection.has(clippingToolObject)) {
    collectionComponent.selection.value = [
      collectionComponent.getListItemForItem(clippingToolObject)!,
    ];
    collectionComponent.openEditorWindow(clippingToolObject);
  } else {
    app.windowManager.add(
      createEditorWindowComponentOptions(
        app,
        clippingToolObject,
        `${collectionComponent.id}-editor`,
      ),
      name,
    );
  }
}
