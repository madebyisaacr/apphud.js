import { CustomerData, Events, User, SubscriptionParams, Subscription, Message, SuccessMessage, AttributionData } from "../../types";
declare const _default: {
    createUser: (data: CustomerData) => Promise<User>;
    createEvent: (data: Events) => Promise<Message>;
    baseHeaders: () => HeadersInit;
    createSubscription: (providerId: string, data: SubscriptionParams) => Promise<Subscription>;
    setAttribution: (deviceId: string, data: AttributionData) => Promise<SuccessMessage>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map