import {log} from "../../utils";
import {initializePaddle, Paddle} from '@paddle/paddle-js'
import {PaymentForm} from "../../types";
import FormBuilder from "./formBuilder";

class PaddleForm implements PaymentForm {
    private elementID = "payment-element"
    private form: HTMLFormElement | null = null
    private paddle: Paddle | null = null

    constructor(private providerId: string, private apiKey: string, private formBuilder: FormBuilder) {}

    /**
     * Show paddle form
     * @param selector - element selector on page
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     */
    public async show(selector: string, paywallId: string | undefined, placementId: string | undefined): Promise<void> {
        log("selector", selector)
        log("vendor", this.apiKey)
        log("paywallID", paywallId)
        log("placementId", placementId)

        const pad = await initializePaddle({environment: "sandbox", token: ""})

        if (pad) {
            this.paddle = pad
        }
    }
}

export default PaddleForm
