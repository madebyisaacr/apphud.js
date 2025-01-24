interface Router {
    userUrl: () => string;
    eventUrl: () => string;
    attributionUrl: (deviceId: string) => string;
    paymentIntentUrl: (providerId: string) => string;
    subscribeUrl: (providerId: string) => string;
    customerUrl: (providerId: string) => string;
}
declare const router: Router;
export default router;
//# sourceMappingURL=router.d.ts.map