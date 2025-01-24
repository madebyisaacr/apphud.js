import { CustomerData, Events, User, SubscriptionParams, Subscription, Message, SuccessMessage, AttributionData, CustomerSetup, CustomerParams } from "../../types";
declare const _default: {
    createUser: (data: CustomerData) => Promise<User>;
    createEvent: (data: Events) => Promise<Message>;
    baseHeaders: () => HeadersInit;
    createSubscription: (providerId: string, data: SubscriptionParams) => Promise<Subscription>;
    setAttribution: (deviceId: string, data: AttributionData) => Promise<SuccessMessage>;
    createCustomer: (providerId: string, data: CustomerParams) => Promise<CustomerSetup>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map