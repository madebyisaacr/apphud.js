import {documentReady, log, logError} from "../../utils"
import api from '../api'
import {
    DeepLinkURL,
    SelectedProductDuration,
} from "../config/constants"
import {CustomerSetup, PaymentForm, PaymentProviderFormOptions, Subscription, User, StripeSubscriptionOptions} from "../../types"
import {
    loadStripe,
    Stripe,
    StripeElements,
    StripeElementsOptions,
    StripePaymentElement,
    StripePaymentElementChangeEvent
} from "@stripe/stripe-js";
import {setCookie} from "../../cookies";
import {config} from "../config/config";
import FormBuilder from "./formBuilder";

class StripeForm implements PaymentForm {
    private readonly elementIDs = {
        new: {
            form: "apphud-stripe-payment-form",
            payment: "stripe-payment-element",
            submit: "stripe-submit",
            error: "stripe-error-message"
        },
        old: {
            form: "apphud-payment-form",
            payment: "payment-element",
            submit: "submit",
            error: "error-message"
        }
    }
    
    private formType: 'new' | 'old' = 'new';
    
    private stripe: Stripe | null = null
    private elements: StripeElements | undefined = undefined
    private paymentElement: StripePaymentElement | null = null
    private subscription: Subscription | null = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."
    private customer: { id: string, client_secret: string } | null = null;
    private currentProductId: string | null = null;
    private currentPaywallId: string | undefined;
    private currentPlacementId: string | undefined;
    private subscriptionOptions?: StripeSubscriptionOptions;

    constructor(private user: User, private providerId: string, private accountId: string, private formBuilder: FormBuilder) {
        documentReady(async () => {
            this.injectStyles();
            let key = config.stripeLiveKey

            if (config.debug) {
                key = config.stripeTestKey
            }

            this.stripe = await loadStripe(key, {stripeAccount: this.accountId})
        })
    }

    private injectStyles(): void {
        const styleId = 'apphud-stripe-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const styles = `
            .stripe-element-container {
                padding: 10px 0;
            }

            #${this.elementIDs.new.payment},
            #${this.elementIDs.old.payment} {
                width: 100%;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Show Stripe form
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     * @param subscriptionOptions - Optional subscription options
     */
    public async show(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions = {},
        subscriptionOptions?: StripeSubscriptionOptions
    ): Promise<void> {
        this.currentProductId = productId;
        this.currentPaywallId = paywallId;
        this.currentPlacementId = placementId;
        this.subscriptionOptions = subscriptionOptions;
        this.formBuilder.emit("payment_form_initialized", { paymentProvider: "stripe", event: { selector: "#apphud-stripe-payment-form" } })

        // Detect which form type is present
        this.formType = document.getElementById(this.elementIDs.new.form) ? 'new' : 'old';
        
        const submitButton = document.querySelector(`#${this.elementIDs[this.formType].submit}`)

        if (!submitButton) {
            logError(`Submit button is required. Add <button id="${this.elementIDs[this.formType].submit}">Pay</button>`)
            return
        }

        this.submit = submitButton as HTMLButtonElement
        this.setButtonState("loading")

        if (this.submit.innerText !== "") {
            this.submitReadyText = this.submit.innerText
        }

        try {
            // Just create the customer and initialize the form
            log("Create Stripe customer for user", this.user.id);
            const customer = await this.createCustomer();
            this.customer = { id: customer.id, client_secret: customer.client_secret };

            // Initialize Stripe elements
            this.initStripe(options);
            
            // Setup form submission handler
            this.setupForm(options)

        } catch (error) {
            logError("Failed to initialize Stripe form:", error)
            this.setButtonState("ready")
            
            const errorElement = document.querySelector(`#${this.elementIDs[this.formType].error}`)
            if (errorElement) {
                errorElement.textContent = "Failed to initialize payment form. Please try again."
            }
            
            this.formBuilder.emit("payment_failure", {
                paymentProvider: "stripe",
                event: { error }
            })
        }
    }

    private setButtonState(state: "loading" | "ready" | "processing"): void {
        if (!this.submit) {
            logError("Submit button not found. Failed to set state:", state)
            return
        }

        switch (state) {
            case "loading":
                this.submit.setAttribute("disabled", "disabled")
                break
            case "ready":
                this.submit.removeAttribute("disabled")
                this.submit.innerText = this.submitReadyText
                break
            case "processing":
                this.submit.setAttribute("disabled", "disabled")
                this.submit.innerText = this.submitProcessingText
                break
        }
    }

    /**
     * Create subscription
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param customerId - customer id
     * @param paymentMethodId - payment method id
     * @private
     */
    private async createSubscription(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        customerId: string, 
        paymentMethodId: string
    ): Promise<void> {
        const payload = {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            customer_id: customerId,
            payment_method_id: paymentMethodId,
            ...(this.subscriptionOptions?.trialDays && { trial_period_days: this.subscriptionOptions.trialDays }),
            ...(this.subscriptionOptions?.couponId && { discount_id: this.subscriptionOptions.couponId })
        };

        log('Creating subscription with payload:', payload);
        this.subscription = await api.createSubscription(this.providerId, payload);

        if (!this.subscription) {
            throw new Error('Subscription was not created');
        }

        log('Subscription created', this.subscription);
    }    

    private async createCustomer(): Promise<CustomerSetup> {
        const customer = await api.createCustomer(this.providerId, {
            user_id: this.user.id,
            payment_methods: ['card', 'bancontact', 'sepa_debit']
        });
    
        if (!customer) {
            throw new Error('Failed to create customer');
        }
    
        log('Customer created', customer);
        return customer;
    }
    

    /**
     * Initialize Stripe elements
     * @private
     * @param options - Payment form options including Stripe UI customization
     */
    private initStripe(options?: PaymentProviderFormOptions): void {
        if (!this.stripe) {
            logError('No stripe initialized')
            return
        }

        if (!this.customer) {
            logError('Customer not initialized')
            return
        }

        const stripeAppearance = options?.stripeAppearance && {
            theme: options.stripeAppearance.theme,
            variables: options.stripeAppearance.variables,
        }

        // Define elements options
        const elementsOptions: StripeElementsOptions = {
            clientSecret: this.customer.client_secret,
            appearance: stripeAppearance,
            loader: "always"
        }

        this.elements = this.stripe.elements(elementsOptions)
        
        // Create and mount the Payment Element
        const paymentElement = this.elements.create('payment')
        
        const paymentElementContainer = document.getElementById(this.elementIDs[this.formType].payment);
        if (paymentElementContainer) {
            paymentElementContainer.innerHTML = '<div class="stripe-element-container"></div>';
            paymentElement.mount(`#${this.elementIDs[this.formType].payment} .stripe-element-container`);
        }

        this.paymentElement = paymentElement;

        // Event listener for ready state
        paymentElement.on('ready', (e) => {
            this.setButtonState("ready")
            this.formBuilder.emit("payment_form_ready", { paymentProvider: "stripe", event: e })
        });

        // Event listener for change events
        paymentElement.on('change', (event: StripePaymentElementChangeEvent) => {
            const displayError = document.querySelector(`#${this.elementIDs[this.formType].error}`)
            if (displayError) {
                // Clear any previous error messages when the form is valid
                if (event.complete) {
                    displayError.textContent = "";
                }
            }
        });

        // Add a separate error event listener for loader errors
        paymentElement.on('loaderror', (event) => {
            const displayError = document.querySelector(`#${this.elementIDs[this.formType].error}`)
            if (displayError && event.error) {
                displayError.textContent = event.error.message || null;
            }
        });
    }

    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private async setupForm(options?: PaymentProviderFormOptions): Promise<void> {
        const form = document.querySelector(`#${this.elementIDs[this.formType].form}`)

        if (!form) {
            logError("Payment form: no form provided")
            return
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault()
            this.setButtonState("processing")

            if (!this.stripe || !this.elements) {
                logError("Stripe or elements not initialized")
                return
            }

            try {
                // Step 1: Confirm SetupIntent first
                const { error: setupError, setupIntent } = await this.stripe.confirmSetup({
                    elements: this.elements,
                    confirmParams: {
                        return_url: this.ensureHttpsUrl(options?.successUrl || window.location.href),
                    },
                    redirect: 'if_required'
                });

                if (setupError) {
                    throw setupError;
                }

                // Step 2: Create subscription using the payment method
                const paymentMethodId = setupIntent.payment_method as string;
                await this.createSubscription(
                    this.currentProductId!, 
                    this.currentPaywallId, 
                    this.currentPlacementId, 
                    this.customer!.id, 
                    paymentMethodId
                );

                // Step 3: Confirm payment if needed (subscription returned client_secret)
                if (this.subscription?.client_secret) {
                    const { error: confirmError } = await this.stripe.confirmCardPayment(
                        this.subscription.client_secret
                    );
                    if (confirmError) {
                        throw confirmError;
                    }
                }

                // Handle successful subscription
                const deepLink = this.subscription!.deep_link;
                if (deepLink) {
                    setCookie(DeepLinkURL, deepLink, SelectedProductDuration);
                }

                setTimeout(() => {
                    if (options?.successUrl && options.successUrl !== 'undefined') {
                        document.location.href = options.successUrl;
                    } else {
                        document.location.href = config.baseSuccessURL + '/' + deepLink;
                    }
                }, config.redirectDelay);

            } catch (error) {
                logError("Failed to process payment:", error)
                this.setButtonState("ready")
                
                const errorElement = document.querySelector(`#${this.elementIDs[this.formType].error}`)
                if (errorElement) {
                    errorElement.textContent = error instanceof Error ? error.message : "Failed to process payment. Please try again."
                }
                
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error }
                })
            }
        })
    }

    // Add this helper method to ensure the URL has a scheme
    private ensureHttpsUrl(url: string): string {
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    }
}

export default StripeForm