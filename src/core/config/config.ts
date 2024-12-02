import {Config} from '../../types'

export const config: Config = {
    apiKey: "",
    _baseURL: process.env.BASE_URL!,
    debug: false,
    websiteVersion: '0.0.1',
    httpRetriesCount: 3,
    language: "en",
    httpRetryDelay: 1000,
    redirectDelay: 1000,
    headers: {},
    _stripeLiveKey: process.env.APPHUD_STRIPE_LIVE_KEY!,
    _stripeTestKey: process.env.APPHUD_STRIPE_TEST_KEY!,
};
