import {deleteCookie, getCookie, setCookie} from '../cookies';
import {config} from './config/config';
import api from "./api";
import u, {canStringify, log, logError, generateSHA256} from "../utils";
import {
    VariableDataAttribute,
    DeepLinkURL,
    EventsKey,
    SelectedProductDuration,
    StartAppVersionKey,
    UserCookieDuration,
    UserIdKey,
    SelectedBundleIndex
} from './config/constants';
import {
    Apphud, AttributionData,
    Config,
    CustomerData,
    Error,
    EventData,
    Events,
    ApphudFunc,
    ApphudHash,
    LifecycleEventCallback,
    LifecycleEventName,
    LifecycleEvents,
    PaymentProvider,
    PaymentProviderFormOptions,
    Paywall,
    Placement,
    Product,
    User,
    PaymentProviderKind,
    ProductBundle
} from '../types'

import UserAgent from 'ua-parser-js'
import FormBuilder from "./paymentForms/formBuilder";

/**
 * The main interface for the Apphud SDK. This should be initialized
 * immediately when your app starts. Ensure that only a single instance
 * of ApphudSDK is created at any given time!
 * @public
 */
export default class ApphudSDK implements Apphud {
    public placements: Placement[] = []
    public user: User | undefined = undefined
    public currentPaymentProvider: PaymentProvider | undefined = undefined
    private _currentProduct: Product | undefined | null = undefined
    private _currentPlacement: Placement | undefined = undefined
    private _currentPaywall: Paywall | undefined = undefined
    private userID: string | undefined = undefined
    private hashedUserID: string | undefined = undefined
    private isReady: boolean = false
    private queue: ApphudFunc[] = []
    private events: LifecycleEvents = {}
    private eventQueue: EventData[] = []
    private isInitialized: boolean = false;
    private isPaywallShown: boolean = false;
    // private params = new URLSearchParams(window.location.search);

    constructor() {}

    private checkInitialization(): void {
        if (!this.isInitialized) {
            logError("Apphud SDK not initialized");
        }
    }

    /**
     * Initialized SDK
     * @param options
     */
    public async init(options: Config): Promise<void> {
        log('init', options)

        const placeholderKeys = [
            "your_api_key",
            "your_api_key_here",
            "YOUR-APPHUD-FLOW-KEY"
        ];

        if (placeholderKeys.includes(options.apiKey)) {
            logError("You did not provide API Key for Web SDK. Check script tags inside body tag. Learn more: https://docs.apphud.com/docs/flow-builder");
            return;
        }

        for (const key in options) {
            if (Object.prototype.hasOwnProperty.call(options, key)) {
                (config as any)[key] = options[key as keyof Config];
            }
        }
        config.headers = api.baseHeaders()

        // push events from queue
        try {
            this.eventQueue = JSON.parse(getCookie(EventsKey) || "[]");

            for (let i = 0; i < this.eventQueue.length; i++) {
                this.trackEvent(this.eventQueue[i])
            }
        } catch (e: any) {
            logError(e as Error);
        }

        this.isInitialized = true;

        u.documentReady(async (): Promise<void> => {
            await this.initializeApp()
        });
    };

    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    public on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void {
        this.checkInitialization();

        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);
    }

    private emit(eventName: LifecycleEventName, event: any): void {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(event));
        }
    }

    /**
     * Get saved deeplink after subscription created
     */
    public getDeepLink(): string | null {
        this.checkInitialization();

        return getCookie(DeepLinkURL)
    }

    /**
     * Get current User ID from cookies
     */
    public getUserID(): string | undefined {
        this.checkInitialization();

        const uid = getCookie(UserIdKey);

        if (uid)
            return uid
    }

    /**
     * Reset everything. Remove User ID from cookies and flush events queue
     */
    public reset(): boolean {
        this.checkInitialization();
        
        deleteCookie(UserIdKey);
        deleteCookie(EventsKey);

        return true;
    }

    /**
     * Track event
     * @param name - event name
     * @param properties - event properties
     * @param userProperties - user properties
     */
    public track(name: string, properties: ApphudHash, userProperties: ApphudHash): boolean {
        this.checkInitialization();

        // generate unique id
        const event: EventData = {
            name: name,
            properties: properties || {},
            user_properties: userProperties || {},
            timestamp: u.timestamp(),
            insert_id: u.generateId()
        };

        log('event', event);

        this.ready((): void => {
            event.user_id = this.getUserID();
            event.device_id = this.getUserID();

            this.eventQueue.push(event);
            this.saveEventQueue();

            // wait in case navigating to reduce duplicate events
            setTimeout((): void => {
                this.trackEvent(event);
            }, 1000);
        });

        return true;
    };

    /**
     * Set email to current user
     * @param email - user email
     */
    public async setEmail(email: string): Promise<void> {
        this.checkInitialization();

        const user = await this.createUser({email: email}, true)

        if (user)
            this.user = user
    }

    /**
     * Start SDK. Create user, set placements, paywalls and products to current state. Trigger ready. Operate variables and prices.
     */
    private async initializeApp(initial: boolean = true): Promise<void> {
        const user = await this.createUser(null, false);

        if (user)
            this.user = user

        this.setPlacementsAndProducts()
        this.setPaymentProvider()
        this.operateVariables()
        this.operateAttribution()

        this.setReady(initial)
    }

    /**
     * Show payment form with saved product to cookies
     * @param options - form options
     * @param product - product id - optional
     */
    public paymentForm(options: PaymentProviderFormOptions, product?: string): void {
        this.checkInitialization();

        this.ready(async (): Promise<void> => {

            if (options.paymentProvider) {
                log("Setting preferred payment provider:", options.paymentProvider)
                this.setPaymentProvider(options.paymentProvider)
            } else {
                log("Payment form options:", options)
                log("No preferred payment provider specified, using default")
            }

            if (!this.currentProduct()) {
                logError("Payment form: product is required")
                return
            }

            if (!this.currentPaywall()) {
                logError("Payment form: paywall is required")
                return
            }

            if (!this.currentPlacement()) {
                logError("Payment form: placement is required")
                return
            }

            log("Initializing payment form with payment provider:", this.currentPaymentProvider)

            const productId = product || this.currentProduct()!.base_plan_id

            if (!productId) {
                logError("Unable to initializeApp the payment form because the product is absent.")
                return
            }

            if (!this.currentPaymentProvider) {
                logError("Unable to initializeApp the payment form because the payment provider is absent.");
                return
            }
            if (!this.user) {
                logError("Payment form: no user");
                return
            }

            const builder = new FormBuilder(this.currentPaymentProvider, this.user)

            const formEvents: LifecycleEventName[] = ["payment_form_initialized", "payment_form_ready", "payment_failure", "payment_success"]

            formEvents.forEach((formEvent) => {
                builder.on(formEvent, (e) => {
                    this.emit(formEvent, e)
                })

                if (formEvent === "payment_form_ready") {
                    if (this._currentPaywall !== undefined && this._currentPlacement !== undefined) {
                        this.track("paywall_checkout_initiated", { paywall_id: this._currentPaywall.id, placement_id: this._currentPlacement.id }, {})
                    } else {
                        logError('Unable to track the "paywall_checkout_initiated" event: either paywall_id or placement_id is empty.')
                    }
                }
            })

            log("Show payment form for product:", productId)
            await builder.show(productId, this.currentPaywall()!.id, this.currentPlacement()!.id, options)
        })
    }

    /**
     * Save selected placement and bundle
     * @param placementID - identifier of placement
     * @param bundleIndex - index of product bundle in placement paywall
     */
    public selectPlacementProduct(placementID: string, bundleIndex: number): void {
        this.checkInitialization();

        log("Save placement and bundle", placementID, bundleIndex);

        const placement = this.findPlacementByID(placementID);
        if (!placement || placement.paywalls.length === 0) {
            logError("No placement or paywall found for ID:", placementID);
            return;
        }

        const paywall = placement.paywalls[0];
        const selectedBundle = paywall.items[bundleIndex];
        if (!selectedBundle) {
            logError("No product bundle found at index:", bundleIndex);
            return;
        }

        // If we have a current payment provider, check compatibility
        if (this.currentPaymentProvider) {
            const compatibleProduct = this.findCompatibleProduct(selectedBundle, this.currentPaymentProvider);
            if (!compatibleProduct) {
                // Current provider is not compatible with selected product
                const compatibleProviders = this.getCompatibleProviders(selectedBundle);
                if (compatibleProviders.length > 0) {
                    // Auto-switch to first compatible provider
                    this.currentPaymentProvider = compatibleProviders[0];
                    this.emit("payment_provider_changed", {
                        provider: this.currentPaymentProvider,
                        reason: "product_compatibility"
                    });
                } else {
                    logError("No compatible payment providers found for selected product bundle");
                    return;
                }
            }
        }

        this.setCurrentItems(placementID, bundleIndex);
        setCookie(SelectedBundleIndex, `${placementID},${bundleIndex}`, SelectedProductDuration);
        this.emit("product_changed", this.currentProduct());
    }

    /**
     * Set current placement, paywall, product bundle and compatible product
     * @param placementID - placement identifier
     * @param bundleIndex - index of product bundle
     * @private
     */
    private setCurrentItems(placementID: string, bundleIndex: number) {
        this._currentPlacement = this.findPlacementByID(placementID);
        if (this._currentPlacement && this._currentPlacement.paywalls.length > 0) {
            this._currentPaywall = this._currentPlacement.paywalls[0];
            const bundle = this._currentPaywall.items[bundleIndex];
            
            if (bundle) {
                // Find compatible product from bundle based on current payment provider
                if (this.currentPaymentProvider) {
                    this._currentProduct = this.findCompatibleProduct(bundle, this.currentPaymentProvider);
                } else {
                    // If no payment provider is set, use the first product in the bundle
                    this._currentProduct = bundle.products[0];
                }

                // Check for required price macros
                if (bundle.properties) {
                    const macrosToCheck = [
                        'new-price',
                        'old-price',
                        'full-price',
                        'discount',
                        'duration',
                        'custom-1',
                        'custom-2',
                        'custom-3'
                    ];
                
                    const hasPriceMacros = Object.values(bundle.properties).some((langProps: Record<string, string>) => 
                        macrosToCheck.some(macro => langProps[macro])
                    );

                    if (!hasPriceMacros) {
                        logError(`Placement with identifier "${placementID}" was requested and found, but price macros are missing. Learn how to set up macros here: https://docs.apphud.com/docs/configure-web-placements#setting-up-product-macros`);
                    }
                }

                log("Current placement", this._currentPlacement);
                log("Current paywall", this._currentPaywall);
                log("Current bundle", bundle);
                log("Current product", this._currentProduct);
            }
        }
    }

    /**
     * Set attribution data to user
     * @param data - attribution data dictionary
     */
    public setAttribution(data: AttributionData): void {
        this.checkInitialization();

        log("SetAttribution", data, this.getUserID()!)


        api.setAttribution(this.getUserID()!, data).then(r => log("Attribution set", r))
    }

    private operateAttribution() {
        log("Prepare Attribution")
        const attribution: AttributionData = {}

        this.ready((): void => {
            const apphudData = this.prepareApphudAttributionData()

            // prepare apphud attribution data
            if (apphudData) {
                attribution["apphud_attribution_data"] = apphudData
            }

            // prepare gtag attribution
            const gtagClientID = this.retrieveGtagClientID()
            if (gtagClientID) {
                log("gtag client_id:", gtagClientID)
                attribution["firebase_id"] = gtagClientID
            }

            // prepare facebook attribution
            if (typeof(window.fbq) !== 'undefined') {
                attribution["facebook_data"] = {
                    fbp: getCookie('_fbp'),
                    fbc: getCookie('_fbc'),
                }

                if (this.hashedUserID) {
                    console.log('set external_id to fb: ', this.hashedUserID);

                    window.fbq('trackCustom', 'ApphudInit', {
                        external_id: this.hashedUserID,
                    })
                }
            }

            this.setAttribution(attribution)
        })
    }

    private prepareApphudAttributionData(): Record<string, string | string[] | null> {
        const data = this.getQueryParamsAsJson()
        data["user_agent"] = navigator.userAgent
        data["referrer"] = document.referrer

        return data
    }

    /**
     * Retrieve client_id from gtag.js
     * @private
     */
    private retrieveGtagClientID(): string | null {
        if (typeof(window.gaGlobal) !== 'undefined') {
            return window.gaGlobal.vid
        }

        return null
    }


    private getQueryParamsAsJson(): Record<string, string | string[]> {
        const queryParams = new URLSearchParams(window.location.search);
        const result: Record<string, string | string[]> = {};

        queryParams.forEach((value, key) => {
            // Check if the key already exists
            if (result[key]) {
                // If it exists and is an array, append the new value
                if (Array.isArray(result[key])) {
                    (result[key] as string[]).push(value);
                } else {
                    // Convert to an array if it was a single value
                    result[key] = [result[key] as string, value];
                }
            } else {
                // If it doesn't exist, assign the value directly
                result[key] = value;
            }
        });

        return result;
    }

    /**
     * Sets the current payment provider based on availability and preference
     * @param preferredProvider - Optional. The preferred payment provider kind (e.g., "stripe" or "paddle").
     *                           If specified and available, this provider will be used.
     *                           If not specified or not available, falls back to the first available provider.
     * @private
     */
    private setPaymentProvider(preferredProvider?: PaymentProviderKind): void {
        this.ready((): void => {
            const paymentProviders = this.user?.payment_providers || []

            if (paymentProviders.length === 0) {
                return
            }

            // Try to use preferred provider if specified
            if (preferredProvider) {
                const preferred = paymentProviders.find(provider => provider.kind === preferredProvider)
                if (preferred) {
                    // Check compatibility with current product if one is selected
                    const currentProduct = this.currentProduct()
                    if (currentProduct && currentProduct.store !== preferred.kind) {
                        logError(`Selected product is not compatible with payment provider ${preferred.kind}`)
                        
                        // Try to find a compatible product in the current bundle
                        const currentPaywall = this.currentPaywall()
                        const savedIndices = this.getSavedPlacementBundleIndex()
                        
                        if (currentPaywall && savedIndices.bundleIndex) {
                            const bundle = currentPaywall.items[savedIndices.bundleIndex]
                            if (bundle) {
                                const compatibleProduct = this.findCompatibleProduct(bundle, preferred)
                                if (compatibleProduct) {
                                    this._currentProduct = compatibleProduct
                                    this.currentPaymentProvider = preferred
                                    this.emit("payment_provider_changed", {
                                        provider: preferred,
                                        reason: "product_compatibility"
                                    })
                                    log("Set preferred payment provider:", this.currentPaymentProvider)
                                    return
                                }
                            }
                        }
                        return
                    }
                    
                    this.currentPaymentProvider = preferred
                    this.emit("payment_provider_changed", {
                        provider: preferred,
                        reason: "user_selection"
                    })
                    log("Set preferred payment provider:", this.currentPaymentProvider)
                    return
                }
                logError(`Preferred payment provider ${preferredProvider} not available`)
            }

            // Fallback: use first available provider if no preference or preferred not available
            this.currentPaymentProvider = paymentProviders[0]
            log("Set default payment provider:", this.currentPaymentProvider)
        })
    }

    /**
     * Set language
     * @param language
     */
    public setLanguage(language: string): void {
        this.checkInitialization();

        config.language = language
    }

    /**
     * Sets placements, paywalls and products
     * @private
     */
    private setPlacementsAndProducts(): void {
        this.ready((): void => {
            this.placements = this.user?.placements || []

            log("Placements", this.placements)
            const saved = this.getSavedPlacementBundleIndex()

            if (saved.placementID)
                this.setCurrentItems(saved.placementID, saved.bundleIndex)
        })
    }

    /**
     * Trigger ready and run functions from queue
     * @private
     */
    private setReady(initial: boolean = false): void {
        log("set ready")
        let callback;
        while ((callback = this.queue.shift())) {
            callback();
        }
        this.isReady = true;

        if (initial) {
            this.emit("ready", this)
        }
    }

    /**
     * Save event queue
     * @private
     */
    private saveEventQueue(): void {
        if (canStringify) {
            setCookie(EventsKey, JSON.stringify(this.eventQueue), 1);
        }
    }

    /**
     * Adds device_id, user_id to event
     * @param event - event data
     * @private
     */
    private eventData(event: EventData): Events {
        const data: Events = {
            events: [event],
            device_id: event.device_id,
            user_id: event.user_id,
        }
        delete event.device_id;
        delete event.user_id;

        return data;
    }

    /**
     * Create event or add it to queue if not ready yet
     * @param event - event data
     * @private
     */
    private trackEvent(event: EventData): void {
        this.ready(async (): Promise<void> => {
            api.createEvent(this.eventData(event)).then(() => {
                // remove from queue
                for (let i = 0; i < this.eventQueue.length; i++) {
                    if (this.eventQueue[i].id === event.id) {
                        this.eventQueue.splice(i, 1)
                        break
                    }
                }
                this.saveEventQueue()
                this.initializeApp(false)
            })
        });
    }

    /**
     * Create user
     * @param params - user data
     * @param ready - reset readiness
     * @private
     */
    private async createUser(params: ApphudHash | null, ready: boolean): Promise<User | null> {
        this.isReady = ready;

        this.userID = this.getUserID();
        this.hashedUserID = await generateSHA256(this.userID);

        if (!this.userID) {
            this.userID = u.generateId();

            if (!getCookie(StartAppVersionKey)) {
                setCookie(StartAppVersionKey, config.websiteVersion, UserCookieDuration); // 2 years
            }

            setCookie(UserIdKey, this.userID, UserCookieDuration);
        }

        let data = this.userParams({})

        // referrer
        if (document.referrer.length > 0) {
            data.referrer = document.referrer;
        }

        log("user", data);

        if (params) {
            data = Object.assign(data, params);
        }

        return await api.createUser(data)
    }

    /**
     * Prepare user params
     * @param params - user data
     * @private
     */
    private userParams(params: ApphudHash): CustomerData {
        const userAgent = new UserAgent(navigator.userAgent);

        return {
            user_id: this.userID!,
            locale: u.getLocale(),
            time_zone: u.getTimeZone(),
            is_sandbox: config.debug,
            is_debug: config.debug,
            currency_code: u.getCurrencyCode(),
            country_iso_code: u.getCountryCode(),
            country_code: u.getCountryCode(),
            device_id: this.userID!,
            device_type: userAgent.getDevice().model ?? "unknown",
            device_family: userAgent.getDevice().model ?? "unknown",
            platform: "web2web",
            os_version: userAgent.getOS().version || u.getOSVersion(),
            app_version: config.websiteVersion,
            start_app_version: getCookie(StartAppVersionKey) || config.websiteVersion,
            need_paywalls: true,
            need_placements: true,
            page_url: this.currentPage(),
            user_agent: navigator.userAgent,
            ...params
        }
    }

    /**
     * Current page URL without GET params
     * @private
     */
    private currentPage(): string {
        return window.location.origin + window.location.pathname;
    }

    /**
     * Replace variables on the page
     */
    public operateVariables() {
        this.checkInitialization();

        this.ready((): void => {
            const vars: NodeListOf<Element> = document.querySelectorAll(`[${VariableDataAttribute}]`);

            vars.forEach(elm => {
                const varName = elm.getAttribute(VariableDataAttribute)

                if (varName) {
                    const newVal = this.readVariableValueByKeyPath(varName)

                    log("Replace variable", varName, newVal)

                    if (newVal) {
                        if (varName.endsWith("price") && !this.isPaywallShown) {
                            this.track("paywall_shown", { paywall_id: this._currentPaywall?.id, placement_id: this._currentPlacement?.id }, {});
                            this.isPaywallShown = true;
                        }

                        elm.innerHTML = newVal
                    }
                }
            })
        })
    }

    /**
     * Get saved placement and bundle index from cookies
     * @returns Object containing placementID and bundleIndex from saved selection
     * @private
     */
    private getSavedPlacementBundleIndex(): { placementID: string | undefined, bundleIndex: number } {
        const savedIndices = getCookie(SelectedBundleIndex)

        if (savedIndices !== null) {
            const arr = savedIndices.split(',').map(s => s.trim());

            if (arr.length === 2) {
                return {
                    placementID: arr[0],
                    bundleIndex: parseInt(arr[1]),
                }
            }
        }

        return {
            placementID: undefined,
            bundleIndex: 0,
        }
    }

    /**
     * Get variable value by name
     * @param key - variable name. Example: `product1.description.price`
     * @private
     */
    private readVariableValueByKeyPath(key: string): string | null {
        const keyArr = key.split(',').map(s => s.trim());

        // default indices
        let placementID: string | undefined = undefined
        let bundleIndex = 0

        // last element of string '0,1,path.to.var'
        // returns path.to.var
        const path = keyArr[keyArr.length - 1]

        if (keyArr.length == 3) {
            placementID = keyArr[0]
            bundleIndex = parseInt(keyArr[1])

            // if some of the parts are negative - get either saved values or default 0,0
            if (placementID === null || bundleIndex < 0) {
                const savedPlacementBundle = this.getSavedPlacementBundleIndex()

                placementID = savedPlacementBundle.placementID
                bundleIndex = savedPlacementBundle.bundleIndex
            }
        } else if (keyArr.length === 1) {
            const savedPlacementBundle = this.getSavedPlacementBundleIndex()

            placementID = savedPlacementBundle.placementID
            bundleIndex = savedPlacementBundle.bundleIndex
        }

        const placement = this.findPlacementByID(placementID!)

        if (!placement) {
            log("placement not found with id: ", placementID)
            return null
        }

        log("Placement", placementID, bundleIndex)
        const paywall = placement.paywalls[0]!
        const bundle = paywall!.items[bundleIndex]
        
        if (bundle !== null && bundle !== undefined && bundle.properties !== undefined) {
            return u.getValueByPath(bundle.properties, path)
        }

        return null
    }

    /**
     * Find placement by ID
     * @param id - placement ID
     * @private
     */
    private findPlacementByID(id: string): Placement | undefined {
        const placement = this.placements.find(elm => elm.identifier === id);
        
        if (!placement) {
            const existingIdentifiers = this.placements.map(p => p.identifier);
            console.warn(`Placement with identifier "${id}" was requested, but only these placements were found: [${existingIdentifiers.join(', ')}].`);
        }
        
        return placement;
    }

    public currentProduct(): Product | null {
        this.checkInitialization();
        
        if (this._currentProduct)
            return this._currentProduct

        const paywall = this.currentPaywall()

        if (paywall !== null && paywall !== undefined) {
            // Get first bundle
            const firstBundle = paywall.items[0];
            if (firstBundle && firstBundle.products.length > 0) {
                // If we have a current payment provider, find compatible product
                if (this.currentPaymentProvider) {
                    return this.findCompatibleProduct(firstBundle, this.currentPaymentProvider);
                }
                // Otherwise return first product in bundle
                return firstBundle.products[0];
            }
        }

        return null
    }

    public currentPlacement(): Placement | null {
        this.checkInitialization();

        if (this._currentPlacement)
            return this._currentPlacement

        const placement = this.placements[0]

        if (placement !== null && placement !== undefined) {
            return placement!
        }

        return null
    }

    public currentPaywall(): Paywall | null {
        this.checkInitialization();
        
        if (this._currentPaywall)
            return this._currentPaywall

        const placement = this.currentPlacement()

        if (placement !== null && placement !== undefined) {
            return placement!.paywalls[0]
        }

        return null
    }

    /**
     * Run function or add to queue
     * @param callback - function
     * @private
     */
    private ready(callback: ApphudFunc): void {
        if (this.isReady) {
            callback();
        } else {
            log('not ready push to queue', callback);
            this.queue.push(callback);
        }
    }

    private isProductCompatibleWithProvider(product: Product, provider: PaymentProvider): boolean {
        return product.store === provider.kind && product.payment_provider_id === provider.id;
    }

    private findCompatibleProduct(bundle: ProductBundle, provider: PaymentProvider): Product | null {
        return bundle.products.find(product => this.isProductCompatibleWithProvider(product, provider)) || null;
    }

    private getCompatibleProviders(bundle: ProductBundle): PaymentProvider[] {
        const compatibleProviders: PaymentProvider[] = [];
        
        if (!this.user?.payment_providers) {
            return compatibleProviders;
        }

        return this.user.payment_providers.filter(provider => 
            bundle.products.some(product => this.isProductCompatibleWithProvider(product, provider))
        );
    }
}
