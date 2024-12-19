import {config} from "../config/config";
import {EVENTS, PAYMENT_INTENT, USERS, SUBSCRIBE, ATTRIBUTION} from "./endpoints";

interface Router {
    userUrl: () => string
    eventUrl: () => string
    attributionUrl: (deviceId: string) => string
    paymentIntentUrl: (providerId: string) => string
    subscribeUrl: (providerId: string) => string
}

const router: Router = {
    userUrl(): string {
        return config.baseURL + USERS
    },
    eventUrl(): string {
        return config.baseURL + EVENTS
    },
    attributionUrl(deviceId: string): string {
        return config.baseURL + ATTRIBUTION + '?device_id='+deviceId
    },
    paymentIntentUrl(providerId: string): string {
        return config.baseURL + PAYMENT_INTENT.replace(':id', providerId)
    },
    subscribeUrl(providerId: string): string {
        return config.baseURL + SUBSCRIBE.replace(':id', providerId)
    }
};

export default router
