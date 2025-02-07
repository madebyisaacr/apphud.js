import {
    StripeAppearanceOptions,
    ProductBundle,
    CustomerSetup,
    User
} from "../../types";
import { loadStripe, StripePaymentElementOptions } from "@stripe/stripe-js";
import { log } from "../../utils";
import api from '../api';
import { config } from "../config/config";

export default async function createStripeExpressCheckout({
    elementId,
    productId,
    paywallId,
    placementId,
    appearance,
    options = {},
    providerId,
    accountId,
    user,
    bundle
}: {
    elementId: string;
    productId: string;
    paywallId: string | undefined;
    placementId: string | undefined;
    appearance: StripeAppearanceOptions;
    options?: StripePaymentElementOptions;
    providerId: string;
    accountId: string;
    user: User;
    bundle?: ProductBundle;
}) {
    const customer = await createCustomer(providerId, user);
    const stripe = await loadStripe(config.stripeLiveKey, { stripeAccount: accountId })

    const elements = stripe.elements({
        clientSecret: customer.client_secret,
        appearance: appearance
    })

    const checkout = elements.create("expressCheckout", {
        ...options,
    })

    checkout.mount(`#${elementId}`)
}

async function createCustomer(providerId: string, user: User): Promise<CustomerSetup> {
    const customer = await api.createCustomer(providerId, {
        user_id: user.id,
        payment_methods: ['card', 'bancontact', 'sepa_debit']
    });

    if (!customer) {
        throw new Error('Failed to create customer');
    }

    log('Customer created', customer);
    return customer;
}