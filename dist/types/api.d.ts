export interface Error {
    id: string;
    title: string;
}
export interface BackendResponse {
    data: {
        results: object;
        meta: object;
    };
    errors: Error[];
}
export interface SubscriptionParams {
    user_id: string;
    product_id: string;
    paywall_id?: string;
    placement_id?: string;
}
export interface Subscription {
    id: string;
    client_secret?: string;
    deep_link?: string;
}
//# sourceMappingURL=api.d.ts.map