import { PaymentForm } from "../../types";
import FormBuilder from "./formBuilder";
declare class PaddleForm implements PaymentForm {
    private providerId;
    private apiKey;
    private formBuilder;
    private elementID;
    private form;
    private paddle;
    constructor(providerId: string, apiKey: string, formBuilder: FormBuilder);
    /**
     * Show paddle form
     * @param selector - element selector on page
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     */
    show(selector: string, paywallId: string | undefined, placementId: string | undefined): Promise<void>;
}
export default PaddleForm;
//# sourceMappingURL=paddleForm.d.ts.map