import { PaymentForm, PaymentProviderFormOptions, User, PaymentProvider, PaddleSubscriptionOptions } from "../../types";
import FormBuilder from "./formBuilder";
declare class PaddleForm implements PaymentForm {
    private user;
    private provider;
    private formBuilder;
    private paddle;
    private currentOptions;
    private subscription;
    constructor(user: User, provider: PaymentProvider, formBuilder: FormBuilder);
    private initializePaddleInstance;
    /**
     * Show Paddle payment form
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options including success URL and appearance customization
     * @param subscriptionOptions - Subscription options for the subscription
     */
    show(productId: string, paywallId: string | undefined, placementId: string | undefined, options?: PaymentProviderFormOptions, subscriptionOptions?: PaddleSubscriptionOptions): Promise<void>;
    /**
     * Handle Paddle checkout events
     * @param event - Paddle event data
     * @param options - Form options for handling success/failure redirects
     * @private
     */
    private handlePaddleEvent;
    /**
     * Set payment button state
     * @param state - Button state: "loading" | "ready" | "processing"
     * @private
     */
    private setButtonState;
    /**
     * Add new method for subscription creation
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param subscriptionOptions - Subscription options for the subscription
     * @private
     */
    private createSubscription;
}
export default PaddleForm;
//# sourceMappingURL=paddleForm.d.ts.map