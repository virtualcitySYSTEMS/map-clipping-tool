<template>
  <v-sheet>
    <VcsHelp v-if="isCreate">
      {{ $t('clippingTool.createDescription') }}
    </VcsHelp>
    <VcsFormSection
      v-else
      heading="clippingTool.clippingPlane"
      :header-actions="headerActions"
      :action-button-list-overflow-count="5"
    >
      <v-container class="px-1 py-0">
        <template v-if="currentTransformationMode">
          <v-row>
            <v-col>
              <VcsFeatureTransforms
                :transformation-mode="currentTransformationMode"
                :feature-properties="{ altitudeMode: 'absolute' }"
                :allow-z-input="true"
              />
            </v-col>
          </v-row>
          <v-divider />
        </template>
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel html-for="clipping-tool-layernames">{{
              $t('clippingTool.layerNames')
            }}</VcsLabel>
          </v-col>
          <v-col cols="6">
            <VcsSelect
              id="clipping-tool-layernames"
              :items="[...availableLayerNames]"
              v-model="layerNames"
              multiple
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel html-for="clipping-tool-extrusion">{{
              $t('components.vectorProperties.extrudedHeight')
            }}</VcsLabel>
          </v-col>
          <v-col cols="6">
            <VcsTextField
              id="clipping-tool-extrusion"
              type="number"
              unit="m"
              placeholder="0"
              v-model.number="extrudedHeight"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <VcsCheckbox
            :label="`clippingTool.isInfinite`"
            v-model="isInfinite"
            :true-value="true"
            :false-value="false"
          />
        </v-row>
        <v-row no-gutters>
          <VcsCheckbox
            :label="`clippingTool.cutsGlobe`"
            v-model="cutsGlobe"
            :true-value="true"
            :false-value="false"
          />
        </v-row>
        <v-row no-gutters>
          <VcsCheckbox
            :label="`clippingTool.isInverted`"
            v-model="isInverted"
            :true-value="true"
            :false-value="false"
          />
        </v-row>
      </v-container>
      <v-divider />
      <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
        <VcsFormButton
          @click="addToMyWorkspace()"
          tooltip="clippingTool.addToMyWorkspace"
          icon="$vcsComponentsPlus"
          :disabled="isPersisted"
        />
        <VcsFormButton @click="createNewClippingToolObject()" variant="filled">
          {{ $t('clippingTool.new') }}
        </VcsFormButton>
      </div>
    </VcsFormSection>
  </v-sheet>
</template>

<script lang="ts">
  import { VRow, VCol, VSheet, VContainer, VDivider } from 'vuetify/components';
  import type { VcsAction, VcsUiApp, WindowState } from '@vcmap/ui';
  import {
    VcsCheckbox,
    VcsFeatureTransforms,
    VcsFormButton,
    VcsFormSection,
    VcsLabel,
    VcsSelect,
    VcsTextField,
    VcsHelp,
  } from '@vcmap/ui';
  import type { PropType, Ref, WritableComputedRef } from 'vue';
  import {
    computed,
    defineComponent,
    inject,
    onUnmounted,
    ref,
    watch,
    provide,
  } from 'vue';
  import {
    TransformationMode,
    CesiumTilesetLayer,
    SessionType,
  } from '@vcmap/core';
  import { unByKey } from 'ol/Observable.js';
  import Feature from 'ol/Feature.js';
  import type {
    ClippingObjectProperties,
    ClippingType,
    ClippingToolObject,
  } from './setup.js';
  import { name } from '../package.json';
  import type { ClippingToolPlugin } from './index';
  import {
    createEditAction,
    createShowHideAction,
    createTransformationActions,
  } from './actions.js';
  import { createTitleForClippingToolObject } from './clippingToolCategory.js';
  import { ClippingToolIcons } from './windowHelper.js';

  function createPropertyComputed<T>(
    localValue: Ref<T>,
    key: string,
    feature: Ref<ClippingToolObject | undefined>,
  ): WritableComputedRef<T> {
    return computed({
      get() {
        return localValue.value;
      },
      set(v: T) {
        feature.value?.set(key, v);
      },
    });
  }

  export default defineComponent({
    name: 'ClippingToolWindow',
    components: {
      VRow,
      VCol,
      VSheet,
      VContainer,
      VDivider,
      VcsFormSection,
      VcsLabel,
      VcsTextField,
      VcsFeatureTransforms,
      VcsSelect,
      VcsCheckbox,
      VcsFormButton,
      VcsHelp,
    },
    props: {
      featureId: {
        type: String,
        default: undefined,
        required: false,
      },
      windowState: {
        type: Object as PropType<WindowState>,
        default: () => ({}),
      },
    },
    setup(props) {
      const { windowState } = props;

      const app = inject('vcsApp') as VcsUiApp;
      const plugin = app.plugins.getByKey(name) as ClippingToolPlugin;
      const manager = {
        currentEditSession: plugin.editorSession,
        currentFeatures: computed(() => {
          const features: Feature[] = [];
          if (plugin.activeClippingToolObject.value) {
            features.push(plugin.activeClippingToolObject.value);
          }
          return features;
        }),
      };

      provide('manager', manager);

      const isInfinite = ref(true);
      const cutsGlobe = ref(true);
      const isInverted = ref(true);
      const layerNames = ref<string[]>([]);
      const extrudedHeight = ref<number | undefined>();
      const headerActions = ref<VcsAction[]>([]);
      const isPersisted = ref(false);
      const currentClippingObjectType = ref<ClippingType | undefined>();
      const currentTransformationMode = ref<TransformationMode | undefined>();
      let transformationModeListener = (): void => {};

      let destroyHeaderActions = (): void => {};
      let removeCurrentFeatureListener = (): void => {};

      watch(
        plugin.editorSession,
        (editorSession) => {
          transformationModeListener();

          transformationModeListener = (): void => {};
          currentTransformationMode.value = undefined;

          if (editorSession?.type === SessionType.CREATE) {
            windowState.headerTitle = 'clippingTool.create';

            windowState.headerIcon =
              ClippingToolIcons[editorSession.clippingType];
          } else if (editorSession?.type === SessionType.EDIT_FEATURES) {
            currentTransformationMode.value = editorSession.mode;
            transformationModeListener =
              editorSession.modeChanged.addEventListener((mode) => {
                currentTransformationMode.value = mode;
              });
          }
        },
        { immediate: true },
      );

      function updateWindowTitle(title: string): void {
        windowState.headerTitle = title;
      }

      watch(
        plugin.activeClippingToolObject,
        () => {
          removeCurrentFeatureListener();
          destroyHeaderActions();
          if (plugin.activeClippingToolObject.value) {
            const featureProps =
              plugin.activeClippingToolObject.value.getProperties() as ClippingObjectProperties;
            isInfinite.value = featureProps.isInfinite;
            cutsGlobe.value = featureProps.cutsGlobe;
            isInverted.value = featureProps.isInverted;
            layerNames.value = featureProps.layerNames;
            extrudedHeight.value = featureProps.olcs_extrudedHeight;

            updateWindowTitle(featureProps.title);

            const listener = plugin.activeClippingToolObject.value.on(
              'propertychange',
              ({ key }) => {
                if (key === 'title') {
                  updateWindowTitle(
                    plugin.activeClippingToolObject.value!.get(key) as string,
                  );
                }
                if (key === 'isInfinite') {
                  isInfinite.value = plugin.activeClippingToolObject.value!.get(
                    key,
                  ) as boolean;
                }
                if (key === 'cutsGlobe') {
                  cutsGlobe.value = plugin.activeClippingToolObject.value!.get(
                    key,
                  ) as boolean;
                }
                if (key === 'isInverted') {
                  isInverted.value = plugin.activeClippingToolObject.value!.get(
                    key,
                  ) as boolean;
                }
                if (key === 'layerNames') {
                  layerNames.value = plugin.activeClippingToolObject.value!.get(
                    key,
                  ) as string[];
                }
                if (key === 'olcs_extrudedHeight') {
                  extrudedHeight.value =
                    plugin.activeClippingToolObject.value!.get(key) as
                      | number
                      | undefined;
                }
              },
            );
            isPersisted.value = plugin.collectionComponent.collection.has(
              plugin.activeClippingToolObject.value,
            );

            if (!isPersisted.value) {
              windowState.headerTitle = [
                'clippingTool.temporary',
                `clippingTool.${plugin.activeClippingToolObject.value?.get('clippingType')}`,
              ];
              windowState.headerIcon =
                ClippingToolIcons[
                  plugin.activeClippingToolObject.value.get(
                    'clippingType',
                  ) as ClippingType
                ];
            }

            removeCurrentFeatureListener = (): void => {
              unByKey(listener);
            };
            currentClippingObjectType.value =
              plugin.activeClippingToolObject.value.get(
                'clippingType',
              ) as ClippingType;

            const destroyActions: Array<() => void> = [];

            const { action: showHideAction, destroy: destroyShowHideAction } =
              createShowHideAction(plugin.activeClippingToolObject.value);
            headerActions.value = [showHideAction];

            const transformationModes = [
              TransformationMode.TRANSLATE,
              TransformationMode.ROTATE,
            ];

            if (currentClippingObjectType.value === 'vertical') {
              const { action: editAction, destroy: destroyEditAction } =
                createEditAction(
                  app,
                  plugin.collectionComponent,
                  plugin.clippingFeatureLayer,
                  plugin.activeClippingToolObject.value,
                  plugin.editorSession,
                );
              headerActions.value.push(editAction);
              destroyActions.push(destroyEditAction);
            } else {
              transformationModes.push(TransformationMode.SCALE);
            }

            const {
              actions: transformationActions,
              destroy: destroyTransformationActions,
            } = createTransformationActions(
              app,
              plugin.collectionComponent,
              plugin.clippingFeatureLayer,
              plugin.activeClippingToolObject.value,
              plugin.editorSession,
              transformationModes,
            );
            headerActions.value.push(...transformationActions);
            destroyActions.push(destroyTransformationActions);

            destroyActions.push(destroyShowHideAction);

            destroyHeaderActions = (): void => {
              destroyActions.forEach((callback) => callback());
            };
          } else {
            headerActions.value = [];
            currentClippingObjectType.value = undefined;
            isPersisted.value = false;
          }
        },
        { immediate: true },
      );

      watch(
        () => props.featureId,
        () => {
          if (
            props.featureId &&
            plugin.activeClippingToolObject?.value?.getId() !== props.featureId
          ) {
            const obj = plugin.clippingFeatureLayer.getFeatureById(
              props.featureId,
            );
            if (obj) {
              plugin.activeClippingToolObject.value = obj as ClippingToolObject;
            }
          }
        },
        { immediate: true },
      );

      const availableLayerNames = ref(
        [...app.layers]
          .filter(
            (layer) => layer.active && layer instanceof CesiumTilesetLayer,
          )
          .map((layer) => layer.name),
      );

      const layerListeners = [
        app.layers.added.addEventListener((layer) => {
          if (layer instanceof CesiumTilesetLayer && layer.active) {
            availableLayerNames.value.push(layer.name);
          }
        }),
        app.layers.removed.addEventListener((layer) => {
          const index = availableLayerNames.value.indexOf(layer.name);
          if (index >= 0) {
            availableLayerNames.value.splice(index, 1);
          }
        }),
        app.layers.stateChanged.addEventListener((layer) => {
          if (layer instanceof CesiumTilesetLayer) {
            if (layer.active) {
              availableLayerNames.value.push(layer.name);
            } else {
              const index = availableLayerNames.value.indexOf(layer.name);
              if (index >= 0) {
                availableLayerNames.value.splice(index, 1);
              }
            }
          }
        }),
      ];

      onUnmounted(() => {
        layerListeners.forEach((listener) => listener());
        destroyHeaderActions();
        manager.currentEditSession.value?.stop();
      });

      return {
        manager,
        isCreate: computed(
          () => plugin.editorSession.value?.type === SessionType.CREATE,
        ),
        isPersisted,
        availableLayerNames,
        isInfinite: createPropertyComputed(
          isInfinite,
          'isInfinite',
          plugin.activeClippingToolObject,
        ),
        cutsGlobe: createPropertyComputed(
          cutsGlobe,
          'cutsGlobe',
          plugin.activeClippingToolObject,
        ),
        isInverted: createPropertyComputed(
          isInverted,
          'isInverted',
          plugin.activeClippingToolObject,
        ),
        layerNames: createPropertyComputed(
          layerNames,
          'layerNames',
          plugin.activeClippingToolObject,
        ),
        extrudedHeight: createPropertyComputed(
          extrudedHeight,
          'olcs_extrudedHeight',
          plugin.activeClippingToolObject,
        ),
        addToMyWorkspace(): void {
          if (plugin.activeClippingToolObject.value) {
            const object = plugin.activeClippingToolObject.value;
            object.set(
              'title',
              createTitleForClippingToolObject(
                object.get('clippingType') as ClippingType,
                [...plugin.collectionComponent.collection],
              ),
            );
            plugin.collectionComponent.collection.add(object);
            plugin.collectionComponent.selection.value = [
              plugin.collectionComponent.getListItemForItem(object)!,
            ];
            isPersisted.value = true;
          }
        },
        async createNewClippingToolObject(): Promise<void> {
          if (currentClippingObjectType.value) {
            await plugin.startCreateClippingSession(
              currentClippingObjectType.value,
            );
          } else {
            throw new Error('no current clipping object type');
          }
        },
        headerActions,
        currentTransformationMode,
      };
    },
  });
</script>
