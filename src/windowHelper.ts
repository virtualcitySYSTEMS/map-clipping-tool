import type { VcsUiApp, WindowComponentOptions } from '@vcmap/ui';
import { categoryManagerWindowId, WindowSlot } from '@vcmap/ui';
import ClippingToolWindow from './ClippingToolWindow.vue';
import type { ClippingType, ClippingToolObject } from './setup.js';
import { clippingToolIcons } from './constants';

export function createEditorWindowComponentOptions(
  app: VcsUiApp,
  item?: ClippingToolObject,
  windowId?: string,
): WindowComponentOptions {
  return {
    id: windowId,
    component: ClippingToolWindow,
    parentId: categoryManagerWindowId,
    slot: WindowSlot.DYNAMIC_CHILD,
    state: {
      headerTitle: (item?.get('title') as string) ?? 'clippingTool.create',
      headerIcon: clippingToolIcons[item?.get('clippingType') as ClippingType],
      styles: { width: '280px' },
      infoUrlCallback: app.getHelpUrlCallback('tools/clippingTool.html'),
    },
    props: { featureId: item?.getId() },
  };
}
