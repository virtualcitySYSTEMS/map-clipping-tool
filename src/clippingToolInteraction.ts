import type { CesiumMap, EventAfterEventHandler } from '@vcmap/core';
import {
  AbstractInteraction,
  EventType,
  Projection,
  VcsEvent,
  createClippingFeature,
} from '@vcmap/core';
import type Feature from 'ol/Feature.js';

/**
 * Interaction that listens to a click event and sets a clipping feature on the clicked position.
 */
export default class ClippingToolInteraction extends AbstractInteraction {
  private _isVertical: boolean;

  private _finished: VcsEvent<Feature | undefined>;

  constructor(isVertical: boolean) {
    super(EventType.CLICK);

    this._isVertical = isVertical;
    this._finished = new VcsEvent();

    this.setActive();
  }

  get finished(): VcsEvent<Feature | undefined> {
    return this._finished;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.position) {
      const camera = (event.map as CesiumMap).getScene()?.camera;
      const coordinate = Projection.mercatorToWgs84(event.position);
      const rotate = this._isVertical ? Math.PI / 2 : 0;
      if (camera) {
        const feature = createClippingFeature(
          coordinate,
          camera,
          this._isVertical,
          undefined,
          rotate,
        );
        this._finished.raiseEvent(feature);
      } else {
        this._finished.raiseEvent(undefined);
      }
      event.stopPropagation = true;
    }
    return Promise.resolve(event);
  }
}
