import {
  AbstractInteraction,
  EditFeaturesSession,
  EditGeometrySession,
  EventAfterEventHandler,
  EventType,
  SessionType,
  handlerSymbol,
} from '@vcmap/core';
import { ShallowRef } from 'vue';
import Feature from 'ol/Feature.js';
import { CreateClippingFeatureSession } from './createClippingSession.js';

/**
 * Interaction that ensures that a editor session is stopped when the user
 * clicks somewhere else than on editor vertices/handler.
 */
class EndEditorInteraction extends AbstractInteraction {
  private _currentSession: ShallowRef<
    | CreateClippingFeatureSession
    | EditGeometrySession
    | EditFeaturesSession
    | undefined
  >;

  constructor(
    currentEditorSession: ShallowRef<
      | CreateClippingFeatureSession
      | EditGeometrySession
      | EditFeaturesSession
      | undefined
    >,
  ) {
    super(EventType.CLICK);
    this._currentSession = currentEditorSession;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    const session = this._currentSession.value;
    if (
      !(event?.feature as Feature)?.[handlerSymbol] &&
      (session?.type === SessionType.EDIT_FEATURES ||
        session?.type === SessionType.EDIT_GEOMETRY)
    ) {
      session.stop();
      this._currentSession.value = undefined;
    }
    return Promise.resolve(event);
  }
}

export default EndEditorInteraction;
