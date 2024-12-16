import { Apphud, AttributionData, Config, ApphudHash, LifecycleEventCallback, LifecycleEventName, PaymentProvider, PaymentProviderFormOptions, Paywall, Placement, Product, User } from '../types';
/**
 * The main interface for the Apphud SDK. This should be initialized
 * immediately when your app starts. Ensure that only a single instance
 * of ApphudSDK is created at any given time!
 * @public
 */
export default class ApphudSDK implements Apphud {
    placements: Placement[];
    user: User | undefined;
    currentPaymentProvider: PaymentProvider | undefined;
    private _currentProduct;
    private _currentPlacement;
    private _currentPaywall;
    private userID;
    private hashedUserID;
    private isReady;
    private queue;
    private events;
    private eventQueue;
    private isInitialized;
    constructor();
    private checkInitialization;
    /**
     * Initialized SDK
     * @param options
     */
    init(options: Config): Promise<void>;
    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void;
    private emit;
    /**
     * Get saved deeplink after subscription created
     */
    getDeepLink(): string | null;
    /**
     * Get current User ID from cookies
     */
    getUserID(): string | undefined;
    /**
     * Reset everything. Remove User ID from cookies and flush events queue
     */
    reset(): boolean;
    /**
     * Track event
     * @param name - event name
     * @param properties - event properties
     * @param userProperties - user properties
     */
    track(name: string, properties: ApphudHash, userProperties: ApphudHash): boolean;
    /**
     * Set email to current user
     * @param email - user email
     */
    setEmail(email: string): Promise<void>;
    /**
     * Start SDK. Create user, set placements, paywalls and products to current state. Trigger ready. Operate variables and prices.
     */
    private initializeApp;
    /**
     * Show payment form with saved product to cookies
     * @param options - form options
     * @param product - product id - optional
     */
    paymentForm(options: PaymentProviderFormOptions, product?: string): void;
    /**
     * Save selected placement and price
     * @param placementID - number of placement
     * @param productIndex - number of price in placement paywall
     */
    selectPlacementProduct(placementID: string, productIndex: number): void;
    /**
     * Set attribution data to user
     * @param data - attribution data dictionary
     */
    setAttribution(data: AttributionData): void;
    private operateAttribution;
    private prepareApphudAttributionData;
    /**
     * Retrieve client_id from gtag.js
     * @private
     */
    private retrieveGtagClientID;
    private getQueryParamsAsJson;
    /**
     * Sets current payment provider
     * @private
     */
    private setPaymentProvider;
    /**
     * Set language
     * @param language
     */
    setLanguage(language: string): void;
    /**
     * Sets placements, paywalls and products
     * @private
     */
    private setPlacementsAndProducts;
    /**
     * Trigger ready and run functions from queue
     * @private
     */
    private setReady;
    /**
     * Save event queue
     * @private
     */
    private saveEventQueue;
    /**
     * Adds device_id, user_id to event
     * @param event - event data
     * @private
     */
    private eventData;
    /**
     * Create event or add it to queue if not ready yet
     * @param event - event data
     * @private
     */
    private trackEvent;
    /**
     * Create user
     * @param params - user data
     * @param ready - reset readiness
     * @private
     */
    private createUser;
    /**
     * Prepare user params
     * @param params - user data
     * @private
     */
    private userParams;
    /**
     * Replace variables on the page
     */
    operateVariables(): void;
    /**
     * Get saved product index from cookies
     * @private
     */
    private getSavedPlacementProductIndex;
    /**
     * Get variable value by name
     * @param key - variable name. Example: `product1.description.price`
     * @private
     */
    private readVariableValueByKeyPath;
    private findPlacementByID;
    /**
     * Set current placement, paywall, product
     * @param placementID
     * @param productIndex
     * @private
     */
    private setCurrentItems;
    currentProduct(): Product | null;
    currentPlacement(): Placement | null;
    currentPaywall(): Paywall | null;
    /**
     * Run function or add to queue
     * @param callback - function
     * @private
     */
    private ready;
}
//# sourceMappingURL=index.d.ts.map