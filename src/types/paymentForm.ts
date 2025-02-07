import { PaymentProviderKind, ProductBundle } from "./apphud";
import { Appearance, Layout, StripePaymentElementOptions } from "@stripe/stripe-js";

export interface PaymentForm {
    show: (
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions,
        subscriptionOptions?: SubscriptionOptions
    ) => Promise<void>
}

export type LifecycleEvents = { [eventName: string]: LifecycleEventCallback[] }

export interface PaymentFormBuilder {
    show: (
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions,
        bundle?: ProductBundle
    ) => Promise<void>
}

export interface PaymentProviderFormOptions {
    paymentProvider?: PaymentProviderKind;
    successUrl?: string
    failureUrl?: string
    stripeAppearance?: StripeAppearanceOptions
    paddleAppearance?: PaddleAppearanceOptions
    elementID?: string
    buttonStateSetter?: (state: "loading" | "ready" | "processing") => void
}

export interface Country {
    name: string
    code: string
}

export interface LifecycleEvent {
    paymentProvider: PaymentProviderKind
    event: any
}

export type LifecycleEventCallback = (event: LifecycleEvent) => void

export interface StripeAppearanceOptions {
    theme?: Appearance['theme'];
    variables?: Appearance['variables'];
    layout?: Layout
    rules?: Appearance['rules']
    disableAnimations?: boolean
    labels?: Appearance['labels']
}

export interface PaddleAppearanceOptions {
  theme?: 'light' | 'dark';
}

export interface SubscriptionOptions {
    trialDays?: number;
    discountId?: string;
    couponId?: string;
}

export interface StripeSubscriptionOptions {
    trialDays?: number;
    couponId?: string;
}

export interface PaddleSubscriptionOptions {
    discountId?: string;
}