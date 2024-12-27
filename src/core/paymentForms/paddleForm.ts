import {log, logError} from "../../utils";
import {initializePaddle, Paddle, CheckoutOpenOptions, PaddleEventData} from '@paddle/paddle-js'
import {PaymentForm, PaymentProviderFormOptions, User, PaymentProvider} from "../../types";
import FormBuilder from "./formBuilder";
import {PaymentFormContainer} from "../config/constants";
import {config} from "../config/config";

class PaddleForm implements PaymentForm {
    private paddle: Paddle | null | undefined = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."
    private currentOptions: PaymentProviderFormOptions | null = null

    constructor(private user: User, private provider: PaymentProvider, private formBuilder: FormBuilder) {
        this.initializePaddleInstance()
    }

    private async initializePaddleInstance(): Promise<void> {
        try {
            const environment = config.debug || this.user.is_sandbox ? "sandbox" : "production"
            this.paddle = await initializePaddle({
                environment,
                token: this.provider.token || "",
                eventCallback: (event: PaddleEventData) => {
                    log("Paddle event received:", event.name)
                    this.handlePaddleEvent(event, this.currentOptions)
                }
            })
            log("Paddle initialized successfully")
        } catch (error) {
            logError("Failed to initialize Paddle:", error)
        }
    }

    /**
     * Show Paddle payment form
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options including success URL and appearance customization
     */
    public async show(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void> {
        this.currentOptions = options
        log("Initializing Paddle payment form for product:", productId)
        this.formBuilder.emit("payment_form_initialized", { paymentProvider: "paddle", event: { selector: PaymentFormContainer } })

        // Wait for Paddle to be initialized if it hasn't been yet
        if (!this.paddle) {
            await this.initializePaddleInstance()
        }

        // Verify Paddle is available
        if (!this.paddle) {
            logError("Paddle failed to initialize")
            return
        }

        // Setup form elements
        await this.setupFormElements()
        
        // Setup checkout configuration
        await this.setupCheckout(productId, paywallId, placementId, options)
    }

    private async setupFormElements(): Promise<void> {
        // Verify form container exists
        const form = document.querySelector(PaymentFormContainer)
        if (!form) {
            throw new Error("Payment form container not found")
        }

        // Setup submit button
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

        // Add error message container if it doesn't exist
        if (!document.querySelector('#error-message')) {
            const errorDiv = document.createElement('div')
            errorDiv.id = 'error-message'
            form.appendChild(errorDiv)
        }
    }

    /**
     * Setup checkout configuration and form submission handler
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options including success URL and appearance customization
     * @private
     */
    private async setupCheckout(productId: string, paywallId: string | undefined, placementId: string | undefined, options: PaymentProviderFormOptions): Promise<void> {
        const form = document.querySelector(PaymentFormContainer)

        if (!form) {
            throw new Error("Payment form: no form provided")
        }

        const checkoutConfig: CheckoutOpenOptions = {
            settings: {
                displayMode: "overlay",
                theme: options?.paddleAppearance?.theme || "light",
                locale: this.user.locale || "en"
            },
            items: [{
                priceId: productId,
                quantity: 1
            }],
            customData: {
                apphud_client_id: this.user.id,
                paywall_id: paywallId ?? "unknown",
                placement_id: placementId ?? "unknown",
            },
            customer: this.user.email ? {
                email: this.user.email
            } : undefined
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault()
            this.setButtonState("processing")

            try {
                if (!this.paddle) {
                    throw new Error("Paddle not initialized")
                }
                await this.paddle.Checkout.open(checkoutConfig)
            } catch (error) {
                logError("Failed to open Paddle checkout:", error)
                this.setButtonState("ready")
                
                // Display error to user
                const errorElement = document.querySelector('#error-message')
                if (errorElement) {
                    errorElement.textContent = error instanceof Error ? error.message : "Payment failed"
                }
            }
        })

        // Form is ready
        this.setButtonState("ready")
        this.formBuilder.emit("payment_form_ready", { 
            paymentProvider: "paddle", 
            event: {} 
        })
    }

    /**
     * Handle Paddle checkout events
     * @param event - Paddle event data
     * @param options - Form options for handling success/failure redirects
     * @private
     */
    private handlePaddleEvent(event: PaddleEventData, options: PaymentProviderFormOptions | null): void {
        switch (event.name) {
            case "checkout.completed":
                log("Payment completed successfully")
                this.formBuilder.emit("payment_success", {
                    paymentProvider: "paddle",
                    event: {
                        user_id: this.user.id,
                    }
                })
                if (options?.successUrl) {
                    document.location.href = options.successUrl
                }
                break;
                
            case "checkout.error":
                logError("Payment failed:", event.data)
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "paddle",
                    event: { error: event.data }
                })
                this.setButtonState("ready")
                break;
                
            case "checkout.loaded":
                log("Checkout loaded successfully")
                this.setButtonState("ready")
                this.formBuilder.emit("payment_form_ready", { 
                    paymentProvider: "paddle", 
                    event: {} 
                })
                break;
        }
    }

    /**
     * Set payment button state
     * @param state - Button state: "loading" | "ready" | "processing"
     * @private
     */
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
}

export default PaddleForm
