import {config} from "../config/config";
import {EVENTS, PAYMENT_INTENT, USERS, SUBSCRIBE, ATTRIBUTION} from "./endpoints";

interface Router {
    userUrl: string
    eventUrl: string
    attributionUrl: (deviceId: string) => string
    paymentIntentUrl: (providerId: string) => string
    subscribeUrl: (providerId: string) => string
}

const router: Router = {
    userUrl: config._baseURL + USERS,
    eventUrl: config._baseURL + EVENTS,
    attributionUrl(deviceId: string): string {
        return config._baseURL + ATTRIBUTION + '?device_id='+deviceId
    },
    paymentIntentUrl(providerId: string): string {
        return config._baseURL + PAYMENT_INTENT.replace(':id', providerId)
    },
    subscribeUrl(providerId: string): string {
        return config._baseURL + SUBSCRIBE.replace(':id', providerId)
    }
};

export default router
