import { LifecycleEventName, PaymentFormBuilder, LifecycleEventCallback, PaymentProvider, PaymentProviderFormOptions, User } from "../../types";
declare class FormBuilder implements PaymentFormBuilder {
    private provider;
    private user;
    private events;
    constructor(provider: PaymentProvider, user: User);
    /**
     * Show form on page
     * @param productId - Product ID
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void>;
    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void;
    emit(eventName: LifecycleEventName, event: any): void;
}
export default FormBuilder;
//# sourceMappingURL=formBuilder.d.ts.map