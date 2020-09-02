import { SignalsEvents } from './SignalsEvents'

/**
 * The handler function
 *
 * @export
 * @interface HandlerFunction
 */

export interface HandlerFunction {
  (signal?: SignalsEvents | Error): unknown
}
