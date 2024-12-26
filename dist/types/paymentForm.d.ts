import { PaymentProviderKind } from "./apphud";
import { Appearance, Layout } from "@stripe/stripe-js";
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
    stripeAppearance?: StripeAppearanceOptions;
    paddleAppearance?: PaddleAppearanceOptions;
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
export interface StripeAppearanceOptions {
    theme?: Appearance['theme'];
    variables?: Appearance['variables'];
    layout?: Layout;
}
export interface PaddleAppearanceOptions {
    theme?: 'light' | 'dark';
}
//# sourceMappingURL=paymentForm.d.ts.map