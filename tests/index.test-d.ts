import { expectError, expectType } from 'tsd'
import { HandlerFunction } from '../src/handler'
import { ShutdownCleanup } from '../src/index'
import { SignalsEvents } from '../src/signal'

const handler: HandlerFunction = (signal?: SignalsEvents | Error) => {}
expectType<void>(ShutdownCleanup.registerHandler(handler))

const wrongHandler = (wrongSignal: boolean) => {}
expectError(ShutdownCleanup.registerHandler(wrongHandler))

expectType<boolean>(ShutdownCleanup.addSignal('uncaughtException'))

expectError(ShutdownCleanup.addSignal('myWrongSignal'))

expectType<boolean>(ShutdownCleanup.removeSignal('uncaughtException'))

expectError(ShutdownCleanup.removeSignal('myWrongSignal'))
