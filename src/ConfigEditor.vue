<template>
  <AbstractConfigEditor v-bind="{ ...$attrs, ...$props }" @submit="apply">
    <VcsFormSection heading="clippingTool.config.startupSettings">
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="isInfinite">
            {{ $t('clippingTool.config.isInfinite') }}
          </VcsLabel>
        </v-col>
        <v-col>
          <VcsCheckbox id="isInfinite" v-model="localConfig.isInfinite" />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="cutsGlobe">
            {{ $t('clippingTool.config.cutsGlobe') }}
          </VcsLabel>
        </v-col>
        <v-col>
          <VcsCheckbox id="cutsGlobe" v-model="localConfig.cutsGlobe" />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="horizontalExtrusionHeight">
            {{ $t('clippingTool.config.horizontalExtrusionHeight') }}
          </VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="horizontalExtrusionHeight"
            v-model.number="localConfig.horizontalExtrusionHeight"
            type="number"
            unit="m"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="verticalExtrusionHeight">
            {{ $t('clippingTool.config.verticalExtrusionHeight') }}
          </VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="verticalExtrusionHeight"
            v-model.number="localConfig.verticalExtrusionHeight"
            type="number"
            unit="m"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel
            html-for="verticalRotation"
            help-text="clippingTool.config.verticalRotationHelpText"
            class="pa-1 pr-2"
          >
            {{ $t('clippingTool.config.verticalRotation') }}
          </VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="verticalRotation"
            v-model.number="localConfig.verticalRotation"
            type="number"
            unit="°"
          />
        </v-col>
      </v-row>
    </VcsFormSection>
  </AbstractConfigEditor>
</template>

<script lang="ts">
  import {
    AbstractConfigEditor,
    VcsCheckbox,
    VcsFormSection,
    VcsLabel,
    VcsTextField,
  } from '@vcmap/ui';
  import type { PropType } from 'vue';
  import { defineComponent, ref, toRaw } from 'vue';
  import { VCol, VRow } from 'vuetify/components';
  import type { ClippingConfig } from './index.js';

  export function getDefaultOptions(): Required<ClippingConfig> {
    return {
      horizontalExtrusionHeight: 0,
      verticalExtrusionHeight: 50,
      isInfinite: false,
      cutsGlobe: false,
      verticalRotation: 0,
    };
  }

  export default defineComponent({
    name: 'ConfigEditor',
    components: {
      VCol,
      VRow,
      AbstractConfigEditor,
      VcsCheckbox,
      VcsFormSection,
      VcsLabel,
      VcsTextField,
    },
    props: {
      getConfig: {
        type: Function as PropType<() => ClippingConfig>,
        required: true,
      },
      setConfig: {
        type: Function as PropType<(config: object | undefined) => void>,
        required: true,
      },
    },
    setup(props) {
      const localConfig = ref<ClippingConfig>({
        ...getDefaultOptions(),
        ...props.getConfig(),
      });

      return {
        localConfig,
        apply(): void {
          props.setConfig(structuredClone(toRaw(localConfig.value)));
        },
      };
    },
  });
</script>

<style scoped></style>
