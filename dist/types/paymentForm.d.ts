import { PaymentProviderKind } from "./apphud";
export interface PaymentForm {
    show: (productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions) => Promise<void>;
}
export type LifecycleEvents = {
    [eventName: string]: LifecycleEventCallback[];
};
export interface PaymentFormBuilder {
    show: (productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions) => void;
}
export interface PaymentProviderFormOptions {
    successUrl?: string;
    failureUrl?: string;
}
export interface Country {
    name: string;
    code: string;
}
export interface LifecycleEvent {
    paymentProvider: PaymentProviderKind;
    event: any;
}
export type LifecycleEventCallback = (event: LifecycleEvent) => void;
//# sourceMappingURL=paymentForm.d.ts.map