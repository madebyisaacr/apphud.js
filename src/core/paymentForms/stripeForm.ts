import {documentReady, log, logError} from "../../utils"
import api from '../api'
import {
    PaymentFormContainer,
    DeepLinkURL,
    SelectedProductDuration,
} from "../config/constants"
import {PaymentForm, PaymentProviderFormOptions, Subscription, User} from "../../types"
import {loadStripe, Stripe, StripeElements, StripePaymentElement} from "@stripe/stripe-js";
import {setCookie} from "../../cookies";
import {config} from "../config/config";
import FormBuilder from "./formBuilder";

class StripeForm implements PaymentForm {
    private elementID = "payment-element"
    private stripe: Stripe | null = null
    private elements: StripeElements | undefined = undefined
    private paymentElement: StripePaymentElement | null = null
    private subscription: Subscription | null = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."

    constructor(private user: User, private providerId: string, private accountId: string, private formBuilder: FormBuilder) {
        documentReady(async () => {
            let key = config._stripeLiveKey

            if (config.debug) {
                key = config._stripeTestKey
            }

            this.stripe = await loadStripe(key, {stripeAccount: this.accountId})
        })
    }

    /**
     * Show Stripe form
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    public async show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void> {
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

        log("Create stripe subscription", productId)
        await this.createSubscription(productId, paywallId, placementId)

        this.initStripe()

        if (!this.paymentElement) {
            logError("Payment element was not created")
            return
        }

        if (!this.subscription) {
            logError("Subscription was not created")
            return
        }

        this.setupForm(options)

        this.paymentElement.mount('#' + this.elementID)
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
     * @private
     */
    private async createSubscription(productId: string, paywallId: string | undefined, placementId: string | undefined): Promise<void> {
        this.subscription = await api.createSubscription(this.providerId, {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
        })

        if (!this.subscription) {
            logError(`Subscription was not created for price_id`, productId)
        } else {
            log('Subscription created', this.subscription)
        }
    }

    /**
     * Initialize Stripe elements
     * @private
     */
    private initStripe(): void {
        if (!this.stripe) {
            logError('No stripe initialized')
            return
        }
        this.elements = this.stripe.elements({clientSecret: this.subscription!.client_secret, loader: "always"})
        this.paymentElement = this.elements.create('payment')

        this.paymentElement.on('loaderror', (event) => {
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

        this.paymentElement.on("ready", (e) => {
            this.setButtonState("ready")
            this.formBuilder.emit("payment_form_ready", { paymentProvider: "stripe", event: e })
        })
    }

    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private setupForm(options?: PaymentProviderFormOptions): void {
        // Create the form element
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

            await this.elements?.submit()

            log("elements", this.elements)
            const {error} = await this.stripe.confirmPayment({
                elements: this.elements,
                clientSecret: this.subscription!.client_secret!,
                confirmParams: {
                    return_url: document.location.href,
                },
                redirect: 'if_required'
            })

            if (error) {
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error: error }
                })

                log("payment failed", error)
                // Inform the customer that there was an error
                const errorElement = document.querySelector('#error-message')

                if (errorElement) {
                    errorElement.textContent = error.message || ""
                }

                this.setButtonState("ready")
            } else {
                this.formBuilder.emit("payment_success", {
                    paymentProvider: "stripe",
                    event: {
                        user_id: this.user.id,
                    }
                })

                const deepLink = this.subscription!.deep_link

                if (deepLink) {
                    setCookie(DeepLinkURL, deepLink, SelectedProductDuration)
                }

                setTimeout(() => {
                    if (options?.successUrl) {
                        document.location.href = options?.successUrl
                    } else {
                        document.location.href = process.env.SUCCESS_URL!+'/'+deepLink
                    }
                }, config.redirectDelay)
            }
        })
    }
}

export default StripeForm
