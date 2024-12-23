import { PaymentForm, PaymentProviderFormOptions, User } from "../../types";
import FormBuilder from "./formBuilder";
declare class StripeForm implements PaymentForm {
    private user;
    private providerId;
    private accountId;
    private formBuilder;
    private elementID;
    private stripe;
    private elements;
    private paymentElement;
    private subscription;
    private submit;
    private submitReadyText;
    private submitProcessingText;
    constructor(user: User, providerId: string, accountId: string, formBuilder: FormBuilder);
    /**
     * Show Stripe form
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void>;
    private setButtonState;
    /**
     * Create subscription
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @private
     */
    private createSubscription;
    /**
     * Initialize Stripe elements
     * @private
     * @param options - Payment form options including Stripe UI customization
     */
    private initStripe;
    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private setupForm;
}
export default StripeForm;
//# sourceMappingURL=stripeForm.d.ts.map