import { SignalsEvents } from './signal'

/**
 * The handler function to be called when shutdown signals/events are fired.
 *
 * @export
 * @interface HandlerFunction
 */

export interface HandlerFunction {
  (signal?: SignalsEvents | Error): unknown
}

export const handlers: HandlerFunction[] = []
