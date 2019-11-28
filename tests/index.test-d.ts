import { expectType, expectError } from 'tsd'
import { ShutdownCleanup, HandlerFunction, SignalsEvents } from '../src/index'

const handler: HandlerFunction = (signal?: SignalsEvents | Error) => {}
expectType<void>(ShutdownCleanup.registerHandler(handler))

const wrongHandler = (wrongSignal: boolean) => {}
expectError(ShutdownCleanup.registerHandler(wrongHandler))

expectType<boolean>(ShutdownCleanup.addSignal('uncaughtException'))

expectError(ShutdownCleanup.addSignal('myWrongSignal'))

expectType<boolean>(ShutdownCleanup.removeSignal('uncaughtException'))

expectError(ShutdownCleanup.removeSignal('myWrongSignal'))
