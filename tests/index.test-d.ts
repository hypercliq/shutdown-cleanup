import { expectError, expectType } from 'tsd'
import {
  addSignal,
  HandlerFunction,
  registerHandler,
  removeSignal,
  SignalsEvents,
} from '../dist'

const handler: HandlerFunction = (signal?: SignalsEvents | Error | number) => {}
expectType<void>(registerHandler(handler))

const wrongHandler = (wrongSignal: boolean) => {}
expectError(registerHandler(wrongHandler))

expectType<boolean>(addSignal('uncaughtException'))

expectError(addSignal('myWrongSignal'))

expectType<boolean>(removeSignal('uncaughtException'))

expectError(removeSignal('myWrongSignal'))
