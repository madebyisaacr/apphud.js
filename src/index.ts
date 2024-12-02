export * from './types'
export * from './core'

import Apphud from "./core";

const apphud = new Apphud();

(window as any).ApphudSDK = apphud

export default apphud;
