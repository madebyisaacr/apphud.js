import {
    LifecycleEventName,
    PaymentForm,
    PaymentFormBuilder, LifecycleEventCallback,
    PaymentProvider,
    PaymentProviderFormOptions,
    User, LifecycleEvents
} from "../../types";
import StripeForm from "./stripeForm";
import PaddleForm from "./paddleForm";
import {log} from "../../utils";

class FormBuilder implements PaymentFormBuilder {
    private events: LifecycleEvents = {}

    constructor(private provider: PaymentProvider, private user: User) {}

    /**
     * Show form on page
     * @param productId - Product ID
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    async show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void> {
        let form: PaymentForm
        // implement different types of elements
        switch (this.provider.kind) {
            case "stripe":
                form = new StripeForm(this.user, this.provider.id, this.provider.identifier, this)
                log("Start stripe form for account_id:", this.provider.identifier)
                break
            case "paddle":
                form = new PaddleForm(this.provider.id, this.provider.identifier, this)
                log("Start paddle form for account_id:", this.provider.identifier)
                break
            default:
                throw new Error("Unsupported type " + this.provider.kind)
        }

        await form.show(productId, paywallId, placementId, options)
    }

    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    public on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);
    }

    public emit(eventName: LifecycleEventName, event: any): void {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(event));
        }
    }
}

export default FormBuilder
