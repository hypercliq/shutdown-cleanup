import { SignalsEvents } from './signal'

/**
 * The handler function to be called when shutdown signals/events are fired.
 *
 * @export
 * @interface HandlerFunction
 */
export interface HandlerFunction {
  (signal?: SignalsEvents | Error | number): unknown
}

/**
 * This array contains all the handler functions that will be called upon catching a signal.
 */
export const handlers: HandlerFunction[] = []
