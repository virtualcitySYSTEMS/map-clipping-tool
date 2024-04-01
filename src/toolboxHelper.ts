import type { SelectToolboxComponentOptions, VcsUiApp } from '@vcmap/ui';
import { ToolboxType } from '@vcmap/ui';
import { reactive, watch } from 'vue';
import { CesiumMap } from '@vcmap/core';
import {
  ClippingToolIcons,
  openWindowForClippingToolObject,
} from './windowHelper.js';
import type { ClippingToolPlugin } from './index.js';

type ClippingToolBox = {
  destroy: () => void;
  toolbox: SelectToolboxComponentOptions;
};

function createClippingToolBox(
  app: VcsUiApp,
  name: string,
  windowId: string,
  plugin: ClippingToolPlugin,
): ClippingToolBox {
  const toolbox: SelectToolboxComponentOptions = {
    type: ToolboxType.SELECT,
    action: reactive({
      name,
      currentIndex: 0,
      active: false,
      background: false,
      disabled: false,
      async callback(): Promise<void> {
        if (this.active) {
          if (this.background && plugin.activeClippingToolObject.value) {
            openWindowForClippingToolObject(
              app,
              plugin.collectionComponent,
              plugin.activeClippingToolObject.value,
            );
          } else {
            plugin.activeClippingToolObject.value = undefined;
            plugin.editorSession.value?.stop();
            plugin.collectionComponent.selection.value = [];
            app.windowManager.remove(windowId);
          }
        } else {
          const toolName = this.tools[this.currentIndex].name;
          await plugin.startCreateClippingSession(toolName);
        }
      },
      selected(newIndex) {
        if (newIndex !== this.currentIndex) {
          this.currentIndex = newIndex;
          const toolName = this.tools[this.currentIndex].name;
          // eslint-disable-next-line no-void
          void plugin.startCreateClippingSession(toolName);
        }
      },
      tools: [
        {
          name: 'horizontal',
          icon: ClippingToolIcons.horizontal,
          title: 'clippingTool.createHorizontal',
        },
        {
          name: 'vertical',
          icon: ClippingToolIcons.vertical,
          title: 'clippingTool.createVertical',
        },
      ],
    }),
  };

  const pluginStateWatcher = watch(
    [plugin.editorSession, plugin.activeClippingToolObject],
    () => {
      toolbox.action.active = !!(
        plugin.activeClippingToolObject.value || plugin.editorSession.value
      );
    },
  );

  const clippingToolObjectWatcher = watch(
    plugin.activeClippingToolObject,
    (clippingToolObject) => {
      if (clippingToolObject) {
        toolbox.action.currentIndex = toolbox.action.tools.findIndex(
          (tool) =>
            tool.name === clippingToolObject.getProperty('clippingType'),
        );
      }
    },
  );

  const listeners = [
    app.maps.mapActivated.addEventListener((map) => {
      toolbox.action.disabled = !(map instanceof CesiumMap);
    }),
    app.windowManager.added.addEventListener(({ id }) => {
      if (id === windowId) {
        toolbox.action.background = false;
      }
    }),
    app.windowManager.removed.addEventListener(({ id }) => {
      if (id === windowId) {
        toolbox.action.background = true;
      }
    }),
  ];

  return {
    destroy(): void {
      pluginStateWatcher();
      clippingToolObjectWatcher();
      listeners.forEach((cb) => cb());
    },
    toolbox,
  };
}

export default function addToolButtons(
  app: VcsUiApp,
  name: string,
  windowId: string,
  plugin: ClippingToolPlugin,
): () => void {
  const { toolbox: createToolbox, destroy: destroyCreateToolbox } =
    createClippingToolBox(app, name, windowId, plugin);
  const createId = app.toolboxManager.add(createToolbox, name).id;

  return () => {
    app.toolboxManager.remove(createId);
    destroyCreateToolbox();
  };
}
