import { expectType, expectError } from 'tsd'
import { HandlerFunction } from '../src/HandlerFunction'
import { ShutdownCleanup } from '../src/index'
import { SignalsEvents } from '../src/SignalsEvents'

const handler: HandlerFunction = (signal?: SignalsEvents | Error) => {}
expectType<void>(ShutdownCleanup.registerHandler(handler))

const wrongHandler = (wrongSignal: boolean) => {}
expectError(ShutdownCleanup.registerHandler(wrongHandler))

expectType<boolean>(ShutdownCleanup.addSignal('uncaughtException'))

expectError(ShutdownCleanup.addSignal('myWrongSignal'))

expectType<boolean>(ShutdownCleanup.removeSignal('uncaughtException'))

expectError(ShutdownCleanup.removeSignal('myWrongSignal'))
