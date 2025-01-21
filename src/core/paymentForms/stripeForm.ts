import {documentReady, log, logError} from "../../utils"
import api from '../api'
import {
    PaymentFormContainer,
    DeepLinkURL,
    SelectedProductDuration,
} from "../config/constants"
import {CustomerSetup, PaymentForm, PaymentProviderFormOptions, Subscription, User} from "../../types"
import {
    loadStripe,
    Stripe,
    StripeElements,
    StripeElementsOptions,
    StripeCardNumberElement,
    StripeCardExpiryElementOptions,
    StripeCardCvcElementOptions,
    StripeCardNumberElementOptions,
    StripeElementStyle,
    StripeElementClasses
} from "@stripe/stripe-js";
import {setCookie} from "../../cookies";
import {config} from "../config/config";
import FormBuilder from "./formBuilder";

class StripeForm implements PaymentForm {
    private elementID = "payment-element"
    private stripe: Stripe | null = null
    private elements: StripeElements | undefined = undefined
    private paymentElement: StripeCardNumberElement | null = null
    private subscription: Subscription | null = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."
    private customer: { id: string, client_secret: string } | null = null;
    private currentProductId: string | null = null;
    private currentPaywallId: string | undefined;
    private currentPlacementId: string | undefined;

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
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .stripe-element {
                height: 40px;
                padding: 0 12px;
                border: 1px solid #e6e6e6;
                border-radius: 6px;
                background-color: white;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                display: flex;
                align-items: center;
            }

            .stripe-row {
                display: flex;
                gap: 20px;
            }

            .stripe-column {
                flex: 1;
            }

            .stripe-element--focus {
                border-color: #80bdff;
                box-shadow: 0 1px 3px 0 #cfd7df;
            }

            .stripe-element--invalid {
                border-color: #dc3545;
                box-shadow: 0 1px 3px 0 rgba(220, 53, 69, 0.3);
            }

            .stripe-element--complete {
                border-color: #28a745;
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
     */
    public async show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void> {
        this.currentProductId = productId;
        this.currentPaywallId = paywallId;
        this.currentPlacementId = placementId;
        this.formBuilder.emit("payment_form_initialized", { paymentProvider: "stripe", event: { selector: PaymentFormContainer } })

        const submitButton = document.querySelector('#submit')

        if (!submitButton) {
            logError("Submit button is required. Add <button id=\"submit\">Pay</button>")
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
            
            const errorElement = document.querySelector('#error-message')
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
    private async createSubscription(productId: string, paywallId: string | undefined, placementId: string | undefined, customerId: string, paymentMethodId: string): Promise<void> {
        this.subscription = await api.createSubscription(this.providerId, {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            customer_id: customerId,
            payment_method_id: paymentMethodId,
        });
    
        if (!this.subscription) {
            throw new Error('Subscription was not created');
        }
    
        log('Subscription created', this.subscription);
    }    

    private async createCustomer(): Promise<CustomerSetup> {
        const customer = await api.createCustomer(this.providerId, {
            user_id: this.user.id,
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
            loader: "always",
            appearance: stripeAppearance
        }

        this.elements = this.stripe.elements(elementsOptions)
            
        // Define default styles for Stripe elements
        const defaultStyles: StripeElementStyle = {
            base: {
                color: '#424770',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#dc3545',
                iconColor: '#dc3545'
            }
        };

        // Define classes for Stripe elements
        const elementClasses: StripeElementClasses = {
            base: 'stripe-element',
            focus: 'stripe-element--focus',
            invalid: 'stripe-element--invalid',
            complete: 'stripe-element--complete',
        };

        // Define options for each element with styles and classes
        const cardNumberOptions: StripeCardNumberElementOptions = {
            style: defaultStyles,
            classes: elementClasses,
            showIcon: true,
            placeholder: '1234 1234 1234 1234',
        };

        const cardExpiryOptions: StripeCardExpiryElementOptions = {
            style: defaultStyles,
            classes: elementClasses,
            placeholder: 'MM / YY',
        };

        const cardCvcOptions: StripeCardCvcElementOptions = {
            style: defaultStyles,
            classes: elementClasses,
            placeholder: 'CVC',
        };

        // Create the card elements
        const cardNumberElement = this.elements.create('cardNumber', cardNumberOptions);
        const cardExpiryElement = this.elements.create('cardExpiry', cardExpiryOptions);
        const cardCvcElement = this.elements.create('cardCvc', cardCvcOptions);

        // Mount each element with improved layout
        const paymentElementContainer = document.getElementById(this.elementID);
        if (paymentElementContainer) {
            paymentElementContainer.className = 'stripe-element-container';

            // Card Number Row
            const cardNumberRow = document.createElement('div');
            const cardNumberDiv = document.createElement('div');
            cardNumberDiv.id = 'card-number-element';
            cardNumberRow.appendChild(cardNumberDiv);
            paymentElementContainer.appendChild(cardNumberRow);

            // Expiry and CVC Row
            const secondRow = document.createElement('div');
            secondRow.className = 'stripe-row';

            // Expiry Date Container
            const cardExpiryContainer = document.createElement('div');
            cardExpiryContainer.className = 'stripe-column';
            const cardExpiryDiv = document.createElement('div');
            cardExpiryDiv.id = 'card-expiry-element';
            cardExpiryContainer.appendChild(cardExpiryDiv);

            // CVC Container
            const cardCvcContainer = document.createElement('div');
            cardCvcContainer.className = 'stripe-column';
            const cardCvcDiv = document.createElement('div');
            cardCvcDiv.id = 'card-cvc-element';
            cardCvcContainer.appendChild(cardCvcDiv);

            secondRow.appendChild(cardExpiryContainer);
            secondRow.appendChild(cardCvcContainer);
            paymentElementContainer.appendChild(secondRow);

            // Mount the elements
            cardNumberElement.mount('#card-number-element');
            cardExpiryElement.mount('#card-expiry-element');
            cardCvcElement.mount('#card-cvc-element');
        }

        // Store the elements for later use
        this.paymentElement = cardNumberElement

        // Add event listeners for error handling and readiness
        cardNumberElement.on('loaderror', (event) => {
            this.setButtonState("ready")

            const displayError = document.querySelector("#card-errors")
            if (!displayError) return
            if (!event) return

            if (event.error) {
                displayError.textContent = event.error.message || ""
            } else {
                displayError.textContent = ""
            }
        })

        cardNumberElement.on("ready", (e) => {
            this.setButtonState("ready")
            this.formBuilder.emit("payment_form_ready", { paymentProvider: "stripe", event: e })
        })
    }

    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private async setupForm(options?: PaymentProviderFormOptions): Promise<void> {
        const form = document.querySelector(PaymentFormContainer)

        if (!form) {
            logError("Payment form: no form provided")
            return
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault()
            this.setButtonState("processing")

            if (!this.stripe) {
                logError("Stripe: not initialized")
                return
            }

            if (!this.elements) {
                logError('Stripe: elements not initialized')
                return
            }

            try {
                if (!this.paymentElement) {
                    throw new Error('Card element not initialized');
                }

                const { error, setupIntent } = await this.stripe.confirmCardSetup(this.customer!.client_secret, {
                    payment_method: {
                        card: this.paymentElement,
                    },
                    return_url: this.ensureHttpsUrl(options?.successUrl || window.location.href),
                });

                if (error) {
                    throw error;
                }

                // Create subscription using the customer_id and payment_method_id
                const paymentMethodId = setupIntent.payment_method as string;
                await this.createSubscription(this.currentProductId!, this.currentPaywallId, this.currentPlacementId, this.customer!.id, paymentMethodId);

                // Deep link handling and cookie setting
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
                logError("Failed to confirm card setup:", error)
                this.setButtonState("ready")
                
                const errorElement = document.querySelector('#error-message')
                if (errorElement) {
                    errorElement.textContent = "Failed to initialize payment form. Please try again."
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
