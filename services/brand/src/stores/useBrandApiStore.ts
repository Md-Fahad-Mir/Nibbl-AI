"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ApiError,
  ApiRecord,
  backendApi,
  backendAssetUrl,
  apiClient,
  nibblApi,
  tokenStorage,
} from "@/lib/api/backendApi";
import { NotificationItem, Product } from "@/features/onboarding/utils/mockData";

type LoadState = "idle" | "loading" | "success" | "error";

const listResults = (response: unknown): ApiRecord[] => {
  if (Array.isArray(response)) return response as ApiRecord[];
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { results?: unknown }).results)
  ) {
    return (response as { results: ApiRecord[] }).results;
  }
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { customers?: unknown }).customers)
  ) {
    return (response as { customers: ApiRecord[] }).customers;
  }
  return [];
};

const readError = (error: unknown) => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Could not reach the Nibbl API. Check your connection and API URL.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
};

const roleValue = (profile: ApiRecord | null | undefined) =>
  String(profile?.role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const isBrandProfile = (profile: ApiRecord | null | undefined) =>
  roleValue(profile) === "brand" || roleValue(profile) === "brand_admin";

const isPlatformAdminProfile = (profile: ApiRecord | null | undefined) =>
  roleValue(profile) === "admin" ||
  profile?.is_staff === true ||
  profile?.is_superuser === true;

const brandAccessError =
  "This account is not a brand admin account. Please use the correct portal for this user.";

const applicationDraftKey = "nibbl-brand-application-draft";

const networkRetry = async <T>(request: () => Promise<T>, attempts = 2): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    if (attempts > 1 && error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return networkRetry(request, attempts - 1);
    }
    throw error;
  }
};

const optionalRequest = async <T>(request: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await networkRetry(request);
  } catch {
    return fallback;
  }
};

const saveApplicationDraft = (body: ApiRecord) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(applicationDraftKey, JSON.stringify(body));
};

const submitSavedApplicationDraft = async () => {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(applicationDraftKey);
  if (!raw) return false;
  const body = JSON.parse(raw) as ApiRecord;
  await apiClient.request(backendApi.brand.createApplication, { body });
  localStorage.removeItem(applicationDraftKey);
  return true;
};

const mapProduct = (item: ApiRecord, index: number, fallbackBrandName = ""): Product => ({
  id: String(item.id ?? index),
  name: String(item.name ?? "Untitled product"),
  description: typeof item.description === "string" ? item.description : "",
  brand: String(
    (item.brand && typeof item.brand === "object"
      ? (item.brand as ApiRecord).legal_name
      : undefined) ??
      fallbackBrandName ??
      item.brand_name ??
      (item.brand && typeof item.brand === "object"
        ? (item.brand as ApiRecord).name
        : undefined)
  ),
  imageSrc: backendAssetUrl(item.image_url ?? item.image, "/Auth/rebateImage.svg"),
  category: String(item.category ?? "UNCATEGORIZED").toUpperCase(),
  flavor: String(
    item.flavor ??
      (item.attributes &&
      typeof item.attributes === "object" &&
      "flavor" in item.attributes
        ? (item.attributes as Record<string, unknown>).flavor
        : "")
  ).toUpperCase(),
  format: String(item.format ?? item.sku ?? "").toUpperCase(),
  size: String(item.size_volume ?? item.size ?? ""),
  sku: String(item.sku ?? ""),
  aliases: Array.isArray(item.aliases)
    ? item.aliases.map((alias) =>
        typeof alias === "object" && alias && "alias_text" in alias
          ? String((alias as ApiRecord).alias_text)
          : String(alias)
      )
    : [],
  aliasCount: Number(item.alias_count ?? (Array.isArray(item.aliases) ? item.aliases.length : 0)),
  aliasRecords: Array.isArray(item.aliases)
    ? item.aliases
        .filter((alias): alias is ApiRecord => Boolean(alias) && typeof alias === "object")
        .map((alias) => ({
          id: String(alias.id ?? alias.alias_text),
          alias_text: String(alias.alias_text ?? ""),
        }))
    : [],
  activeCampaigns: Number(item.active_campaigns ?? item.campaign_count ?? 0),
  avgRating: item.avg_rating == null ? null : Number(item.avg_rating),
  reviewCount: Number(item.review_count ?? 0),
});

const loadReviewsForProducts = async (products: Product[]) => {
  const reviewGroups = await Promise.all(
    products.map((product) =>
      optionalRequest(
        () =>
          apiClient.request<unknown>(backendApi.consumer.productReviews(product.id), {
            query: { page_size: 100 },
          }),
        []
      )
    )
  );

  return reviewGroups.flatMap((response, index) => {
    const product = products[index];
    return listResults(response).map((review) => ({
      ...review,
      product: review.product ?? product.id,
      product_id: review.product_id ?? product.id,
      product_name: review.product_name ?? product.name,
      product_image_url: review.product_image_url ?? product.imageSrc,
    }));
  });
};

const mapNotification = (item: ApiRecord): NotificationItem => ({
  id: String(item.id ?? item.created_at ?? Math.random()),
  title: String(item.title ?? item.type ?? "Notification"),
  time: typeof item.created_at === "string" ? new Date(item.created_at).toLocaleString() : "",
  message: String(item.body ?? item.message ?? ""),
  iconSrc: "/Notification/notifications.svg",
  bgClass: "bg-[rgba(0,27,210,0.1)]",
  iconColor: "#001BD2",
});

const brandNameFromState = (state: {
  brand: ApiRecord | null;
  brands: ApiRecord[];
  selectedBrandId: string | null;
}) => {
  const selectedBrand =
    state.brand ||
    state.brands.find((brand) => String(brand.id ?? "") === state.selectedBrandId);
  return String(
    selectedBrand?.legal_name ??
      selectedBrand?.name ??
      selectedBrand?.brand_name ??
      ""
  );
};

export interface SavedCard {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

export interface AutoRefillConfig {
  enabled: boolean;
  amount: string;
  payment_method_id: string;
  estimated_seven_day: string;
  trigger_at: string;
  recommended_amount: string;
  last_refilled_at: string | null;
}

export interface AutoRefillInput {
  enabled: boolean;
  amount: string;
  payment_method_id: string;
}

export interface ReviewSelection {
  lines: { line_item: string; quantity: number; unit_price: string | null }[];
  product: string;
  save_alias?: boolean;
}

export interface DealCampaignInput {
  name: string;
  start_at: string | null;
  end_at: string | null;
  product: string[];
  deal_type: "free" | "bogo_free" | "bogo_half" | "buy_x_get_y";
  max_rebate: string | null;
  fixed_reward: string | null;
  required_quantity: number;
  offer_headline: string;
  offer_description: string;
  desired_redemptions: number;
  estimated_redemption_rate: string;
  cooldown_days: number;
  one_time_only: boolean;
  /** Retailer directory ids: where it's sold (Where to Buy). */
  retailers: string[];
  /** Up to three of `retailers`, shown in the offer summary. */
  featured_retailers: string[];
  /** true = receipts must be from one of `retailers`. */
  retailer_required: boolean;
  /** Discovery geography: where the campaign appears in discovery. */
  geography: "nationwide" | "states" | "zip_radius";
  geography_states: string[];
  geography_areas: { zip: string; radius_miles: number }[];
}

export interface RetailerOption {
  id: string;
  name: string;
  is_verified: boolean;
}

interface BrandApiState {
  accessToken: string | null;
  refreshToken: string | null;
  profile: ApiRecord | null;
  selectedBrandId: string | null;
  brands: ApiRecord[];
  brandApplications: ApiRecord[];
  brand: ApiRecord | null;
  wallet: ApiRecord | null;
  walletTransactions: ApiRecord[];
  products: Product[];
  campaigns: ApiRecord[];
  reviewCampaigns: ApiRecord[];
  redemptions: ApiRecord[];
  reviewQueue: ApiRecord[];
  reviews: ApiRecord[];
  customers: ApiRecord[];
  analyticsOverview: ApiRecord | null;
  analyticsRebatesSummary: ApiRecord | null;
  /** Dashboard snapshots, conversion and campaign performance (Master definitions). */
  analyticsDashboard: ApiRecord | null;
  loadAnalyticsDashboard: (days?: number) => Promise<void>;
  analyticsCampaigns: ApiRecord[];
  analyticsProducts: ApiRecord[];
  members: ApiRecord[];
  notifications: NotificationItem[];
  status: LoadState;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  registerAndApply: (body: {
    fullName: string;
    email: string;
    password: string;
    brandName: string;
    website?: string;
    phone?: string;
    officeLocation?: string;
    category?: string;
  }) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  loadWorkspace: () => Promise<void>;
  selectBrand: (brandId: string) => Promise<void>;
  loadProducts: (brandId?: string) => Promise<void>;
  loadProductAliases: (productId: string) => Promise<void>;
  createProduct: (body: ApiRecord | FormData) => Promise<Product>;
  updateProduct: (productId: string, body: ApiRecord | FormData) => Promise<void>;
  updateProductAliases: (productId: string, aliases: string[]) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  /** Create (campaignId null) or edit a deal-model rebate campaign; optionally
   *  upload its image and submit it for Nibbl review. Returns the campaign. */
  saveDealCampaign: (
    campaignId: string | null,
    body: DealCampaignInput,
    options?: { image?: File | null; submit?: boolean }
  ) => Promise<ApiRecord>;
  campaignAction: (campaignId: string, action: "submit" | "activate" | "pause") => Promise<void>;
  refreshCampaigns: () => Promise<void>;
  loadCampaignExtras: (campaignId: string) => Promise<{ reviews: ApiRecord[]; access: ApiRecord }>;
  /** Nibbl's retailer directory (+ retailers this brand added). */
  loadRetailers: () => Promise<RetailerOption[]>;
  /** Add a retailer missing from the directory (returns the existing one on a name match). */
  addRetailer: (name: string) => Promise<RetailerOption>;
  createReviewCampaign: (body: {
    name: string;
    description?: string;
    productIds: string[];
    dailyBudget: string | number;
    rewardAmount?: string | number;
    isActive?: boolean;
  }) => Promise<void>;
  /** Approve with Nibbl's calculated reward; `selection` = chosen receipt
   *  lines (+ corrections), confirmed product, optional alias. */
  approveReviewQueueItem: (itemId: string, selection?: ReviewSelection) => Promise<void>;
  /** Reward Nibbl would pay for a selection (decides nothing). */
  previewReviewQueueItem: (itemId: string, selection: ReviewSelection) => Promise<string>;
  declineReviewQueueItem: (itemId: string, reasonCode: string, note?: string) => Promise<ApiRecord>;
  updateBrandProfile: (body: ApiRecord | FormData) => Promise<void>;
  inviteMember: (email: string, role: string) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  loadCustomers: (brandId?: string) => Promise<void>;
  suspendCustomer: (userId: string, reason?: string) => Promise<void>;
  reactivateCustomer: (userId: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  createTopupIntent: (amount: string) => Promise<{ client_secret: string; payment_intent_id: string }>;
  refreshWallet: () => Promise<void>;
  createSetupIntent: () => Promise<{ client_secret: string; setup_intent_id: string }>;
  loadSavedCards: () => Promise<SavedCard[]>;
  getAutoRefill: () => Promise<AutoRefillConfig>;
  saveAutoRefill: (config: AutoRefillInput) => Promise<AutoRefillConfig>;
  redeemPromoCode: (code: string) => Promise<ApiRecord>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useBrandApiStore = create<BrandApiState>()(
  persist(
    (set, get) => ({
      accessToken: tokenStorage.getAccess(),
      refreshToken: tokenStorage.getRefresh(),
      profile: null,
      selectedBrandId: null,
      brands: [],
      brandApplications: [],
      brand: null,
      wallet: null,
      walletTransactions: [],
      products: [],
      campaigns: [],
      reviewCampaigns: [],
      redemptions: [],
      reviewQueue: [],
      reviews: [],
      customers: [],
      analyticsOverview: null,
      analyticsRebatesSummary: null,
      analyticsDashboard: null,
      analyticsCampaigns: [],
      analyticsProducts: [],
      members: [],
      notifications: [],
      status: "idle",
      error: null,
      login: async (email, password, rememberMe = false) => {
        set({ status: "loading", error: null });
        try {
          const tokens = await nibblApi.login({
            email: email.trim().toLowerCase(),
            password,
            remember_me: rememberMe,
          });
          tokenStorage.set(tokens.access, tokens.refresh);
          const profile = tokens.user || (await nibblApi.me());
          if (isPlatformAdminProfile(profile)) {
            tokenStorage.clear();
            set({ accessToken: null, refreshToken: null, profile: null });
            throw new Error(brandAccessError);
          }

          let submittedApplicationDraft = false;
          try {
            submittedApplicationDraft = await submitSavedApplicationDraft();
          } catch {
            // Email verification or approval gating can block this until a later login.
          }
          const applicationsResponse = await optionalRequest(
            () => apiClient.request<unknown>(backendApi.brand.applications),
            []
          );
          const brandApplications = listResults(applicationsResponse);
          if (!isBrandProfile(profile) && !submittedApplicationDraft && !brandApplications.length) {
            tokenStorage.clear();
            set({ accessToken: null, refreshToken: null, profile: null });
            throw new Error(brandAccessError);
          }
          set({
            accessToken: tokens.access,
            refreshToken: tokens.refresh,
            profile,
            brandApplications,
            status: "success",
          });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      registerAndApply: async ({
        fullName,
        email,
        password,
        brandName,
        website,
        phone,
        officeLocation,
        category,
      }) => {
        set({ status: "loading", error: null });
        try {
          const message = [
            phone ? `Business phone: ${phone}` : "",
            officeLocation ? `Office location: ${officeLocation}` : "",
            category ? `Business category: ${category}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          await nibblApi.register({
            full_name: fullName,
            email: email.trim().toLowerCase(),
            password,
            role: "consumer",
            accept_terms: true,
          });
          saveApplicationDraft({
            brand_name: brandName,
            contact_email: email.trim().toLowerCase(),
            website,
            message,
          });
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      verifyEmail: async (email, code) => {
        set({ status: "loading", error: null });
        try {
          await nibblApi.verifyEmail({ email: email.trim().toLowerCase(), code: code.trim() });
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      resendEmailVerification: async (email) => {
        set({ status: "loading", error: null });
        try {
          await nibblApi.resendEmailVerification(email.trim().toLowerCase());
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      loadWorkspace: async () => {
        set({ status: "loading", error: null });
        try {
          const profile = await networkRetry(() => nibblApi.me());
          if (isPlatformAdminProfile(profile)) {
            await get().logout();
            set({ status: "error", error: brandAccessError });
            return;
          }

          const applicationsResponse = await optionalRequest(
            () => apiClient.request<unknown>(backendApi.brand.applications),
            []
          );
          const brandApplications = listResults(applicationsResponse);
          if (!isBrandProfile(profile) && !brandApplications.length) {
            await get().logout();
            set({ status: "error", error: brandAccessError });
            return;
          }

          const [brandsResponse, notificationsResponse] = await Promise.all([
            networkRetry(() => apiClient.request<unknown>(backendApi.brand.brands)),
            optionalRequest(() => nibblApi.notifications({ unread: true }), []),
          ]);
          const brands = listResults(brandsResponse);
          const selectedBrandId = get().selectedBrandId || String(brands[0]?.id ?? "");
          set({
            profile,
            brands,
            brandApplications,
            selectedBrandId: selectedBrandId || null,
            notifications: listResults(notificationsResponse).map(mapNotification),
          });
          if (selectedBrandId) await get().selectBrand(selectedBrandId);
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
        }
      },
      loadAnalyticsDashboard: async (days = 30) => {
        const brandId = get().selectedBrandId;
        if (!brandId) return;
        const dashboard = await optionalRequest(
          () => apiClient.request<ApiRecord>(backendApi.brand.analyticsDashboard(brandId), { query: { days: String(days) } }),
          null
        );
        set({ analyticsDashboard: dashboard });
      },
      selectBrand: async (brandId) => {
        set({ selectedBrandId: brandId });
        void get().loadAnalyticsDashboard();
        const [
          brand,
          wallet,
          walletTransactions,
          products,
          campaigns,
          reviewCampaigns,
          redemptions,
          reviewQueue,
          customers,
          analyticsOverview,
          analyticsRebatesSummary,
          analyticsCampaigns,
          analyticsProducts,
          members,
        ] =
          await Promise.all([
            networkRetry(() => apiClient.request<ApiRecord>(backendApi.brand.brandDetail(brandId))),
            optionalRequest(() => apiClient.request<ApiRecord>(backendApi.brand.wallet(brandId)), {}),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.walletTransactions(brandId)), []),
            networkRetry(() => apiClient.request<unknown>(backendApi.brand.products(brandId))),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.campaigns(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.reviewCampaigns(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.redemptions(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.reviewQueue(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.customers(brandId)), []),
            optionalRequest(() => apiClient.request<ApiRecord>(backendApi.brand.analyticsOverview(brandId)), {}),
            optionalRequest(
              () =>
                apiClient.request<ApiRecord>(backendApi.brand.analyticsRebatesSummary(brandId), {
                  query: { period: "30d" },
                }),
              {}
            ),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.analyticsCampaigns(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.analyticsProducts(brandId)), []),
            optionalRequest(() => apiClient.request<unknown>(backendApi.brand.members(brandId)), []),
          ]);
        const mappedProducts = listResults(products).map((product, index) =>
          mapProduct(
            product,
            index,
            String(brand.legal_name ?? brand.name ?? brand.brand_name ?? "")
          )
        );
        const reviews = await loadReviewsForProducts(mappedProducts);
        set({
          brand,
          wallet,
          walletTransactions: listResults(walletTransactions),
          products: mappedProducts,
          campaigns: listResults(campaigns),
          reviewCampaigns: listResults(reviewCampaigns),
          redemptions: listResults(redemptions),
          reviewQueue: listResults(reviewQueue),
          reviews,
          customers: listResults(customers),
          analyticsOverview,
          analyticsRebatesSummary,
          analyticsCampaigns: listResults(analyticsCampaigns),
          analyticsProducts: listResults(analyticsProducts),
          members: listResults(members),
        });
      },
      loadProducts: async (brandId = get().selectedBrandId || undefined) => {
        if (!brandId) return;
        const response = await apiClient.request<unknown>(backendApi.brand.products(brandId));
        const brandName = brandNameFromState(get());
        set({
          products: listResults(response).map((product, index) =>
            mapProduct(product, index, brandName)
          ),
        });
      },
      loadProductAliases: async (productId) => {
        const brandId = get().selectedBrandId;
        if (!brandId) return;
        const response = await apiClient.request<unknown>(
          backendApi.brand.productAliases(brandId, productId)
        );
        const aliasRecords = listResults(response).map((alias) => ({
          id: String(alias.id ?? alias.alias_text),
          alias_text: String(alias.alias_text ?? ""),
        }));
        set({
          products: get().products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  aliases: aliasRecords.map((alias) => alias.alias_text),
                  aliasRecords,
                }
              : product
          ),
        });
      },
      createProduct: async (body) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before creating products.");
        const response = await apiClient.request<ApiRecord>(
          backendApi.brand.createProduct(brandId),
          { body }
        );
        await get().loadProducts(brandId);
        return mapProduct(response, get().products.length, brandNameFromState(get()));
      },
      updateProduct: async (productId, body) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before editing products.");
        await apiClient.request(backendApi.brand.updateProduct(brandId, productId), { body });
        await get().loadProducts(brandId);
      },
      updateProductAliases: async (productId, aliases) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before editing aliases.");
        const product = get().products.find((item) => item.id === productId);
        const existing = product?.aliasRecords || [];
        const normalized = new Set(aliases.map((alias) => alias.trim()).filter(Boolean));
        const existingByText = new Map(
          existing.map((alias) => [alias.alias_text.trim().toLowerCase(), alias])
        );

        await Promise.all(
          aliases
            .map((alias) => alias.trim())
            .filter((alias) => alias && !existingByText.has(alias.toLowerCase()))
            .map((alias) =>
              apiClient.request(backendApi.brand.createProductAlias(brandId, productId), {
                body: { alias_text: alias },
              })
            )
        );

        await Promise.all(
          existing
            .filter((alias) => !normalized.has(alias.alias_text))
            .map((alias) =>
              apiClient.request(
                backendApi.brand.deleteProductAlias(brandId, productId, alias.id)
              )
            )
        );

        await get().loadProductAliases(productId);
      },
      deleteProduct: async (productId) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before deleting products.");
        await apiClient.request(backendApi.brand.deleteProduct(brandId, productId));
        await get().loadProducts(brandId);
      },
      saveDealCampaign: async (campaignId, body, options = {}) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before saving campaigns.");
        const saved = campaignId
          ? await apiClient.request<ApiRecord>(backendApi.brand.updateCampaign(brandId, campaignId), {
              body: body as unknown as ApiRecord,
            })
          : await apiClient.request<ApiRecord>(backendApi.brand.createCampaign(brandId), {
              body: body as unknown as ApiRecord,
            });
        const id = String(saved.id);
        if (options.image) {
          const form = new FormData();
          form.append("image", options.image);
          await apiClient.request(backendApi.brand.campaignImage(brandId, id), { body: form });
        }
        const reviewStatus = String(saved.review_status ?? "");
        if (options.submit && (reviewStatus === "not_submitted" || reviewStatus === "changes_requested")) {
          await apiClient.request(backendApi.brand.submitCampaign(brandId, id));
        }
        await get().refreshCampaigns();
        return get().campaigns.find((campaign) => String(campaign.id) === id) || saved;
      },
      campaignAction: async (campaignId, action) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        const endpoint =
          action === "submit"
            ? backendApi.brand.submitCampaign(brandId, campaignId)
            : action === "activate"
              ? backendApi.brand.activateCampaign(brandId, campaignId)
              : backendApi.brand.pauseCampaign(brandId, campaignId);
        await apiClient.request(endpoint);
        await get().refreshCampaigns();
      },
      loadCampaignExtras: async (campaignId) => {
        const brandId = get().selectedBrandId;
        if (!brandId) return { reviews: [], access: {} };
        const [reviews, access] = await Promise.all([
          optionalRequest(
            () => apiClient.request<unknown>(backendApi.brand.campaignReviews(brandId, campaignId)),
            []
          ),
          optionalRequest(
            () => apiClient.request<ApiRecord>(backendApi.brand.campaignAccess(brandId, campaignId)),
            {}
          ),
        ]);
        return { reviews: listResults(reviews), access };
      },
      loadRetailers: async () => {
        const response = await apiClient.request<unknown>(backendApi.brand.retailers);
        return listResults(response) as unknown as RetailerOption[];
      },
      addRetailer: async (name) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        return apiClient.request<RetailerOption>(backendApi.brand.addRetailer(brandId), {
          body: { name },
        });
      },
      refreshCampaigns: async () => {
        const brandId = get().selectedBrandId;
        if (!brandId) return;
        const [campaigns, analyticsCampaigns] = await Promise.all([
          apiClient.request<unknown>(backendApi.brand.campaigns(brandId)),
          optionalRequest(
            () => apiClient.request<unknown>(backendApi.brand.analyticsCampaigns(brandId)),
            []
          ),
        ]);
        set({
          campaigns: listResults(campaigns),
          analyticsCampaigns: listResults(analyticsCampaigns),
        });
      },
      createReviewCampaign: async ({
        name,
        description = "",
        productIds,
        dailyBudget,
        rewardAmount,
        isActive = true,
      }) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before creating review campaigns.");
        const campaign = await apiClient.request<ApiRecord>(
          backendApi.brand.createReviewCampaign(brandId),
          {
            body: {
              name,
              daily_budget: String(dailyBudget),
              reward_amount: rewardAmount ? String(rewardAmount) : undefined,
              product_context: description,
              product_ids: productIds,
            },
          }
        );
        const campaignId = String(campaign.id);
        await apiClient.request(
          backendApi.brand.generateReviewCampaignPrompts(brandId, campaignId),
          { body: { count: 4 } }
        );
        if (isActive) {
          await apiClient.request(
            backendApi.brand.activateReviewCampaign(brandId, campaignId)
          );
        }
        const reviewCampaigns = await apiClient.request<unknown>(
          backendApi.brand.reviewCampaigns(brandId)
        );
        set({ reviewCampaigns: listResults(reviewCampaigns) });
      },
      approveReviewQueueItem: async (itemId, selection) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before approving reviews.");
        await apiClient.request(backendApi.brand.approveReviewQueueItem(brandId, itemId), {
          body: (selection ?? {}) as unknown as ApiRecord,
        });
        const [reviewQueue, redemptions] = await Promise.all([
          apiClient.request<unknown>(backendApi.brand.reviewQueue(brandId)),
          apiClient.request<unknown>(backendApi.brand.redemptions(brandId)),
        ]);
        set({
          reviewQueue: listResults(reviewQueue),
          redemptions: listResults(redemptions),
        });
      },
      previewReviewQueueItem: async (itemId, selection) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        const result = await apiClient.request<ApiRecord>(
          backendApi.brand.previewReviewQueueItem(brandId, itemId),
          { body: selection as unknown as ApiRecord }
        );
        return String(result.reward ?? "");
      },
      declineReviewQueueItem: async (itemId, reasonCode, note = "") => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before declining reviews.");
        const receipt = await apiClient.request<ApiRecord>(backendApi.brand.declineReviewQueueItem(brandId, itemId), {
          body: { reason_code: reasonCode, reason: note },
        });
        const reviewQueue = await apiClient.request<unknown>(
          backendApi.brand.reviewQueue(brandId)
        );
        set({ reviewQueue: listResults(reviewQueue) });
        return receipt;
      },
      updateBrandProfile: async (body) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before updating profile.");
        const brand = await apiClient.request<ApiRecord>(
          backendApi.brand.updateBrand(brandId),
          { body }
        );
        set((state) => ({
          brand,
          brands: state.brands.map((item) =>
            String(item.id ?? "") === brandId ? brand : item
          ),
        }));
      },
      inviteMember: async (email, role) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before inviting members.");
        await apiClient.request(backendApi.brand.addMember(brandId), {
          body: {
            email,
            role: role.toLowerCase() === "admin" ? "admin" : "member",
          },
        });
        const members = await apiClient.request<unknown>(backendApi.brand.members(brandId));
        set({ members: listResults(members) });
      },
      removeMember: async (membershipId) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before removing members.");
        await apiClient.request(backendApi.brand.removeMember(brandId, membershipId));
        set({
          members: get().members.filter((member) => String(member.id) !== membershipId),
        });
      },
      loadCustomers: async (brandId = get().selectedBrandId || undefined) => {
        if (!brandId) return;
        const customers = await apiClient.request<unknown>(backendApi.brand.customers(brandId));
        set({ customers: listResults(customers) });
      },
      suspendCustomer: async (userId, reason = "") => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before suspending customers.");
        await apiClient.request(backendApi.brand.suspendCustomer(brandId, userId), {
          body: { reason },
        });
        await get().loadCustomers(brandId);
      },
      reactivateCustomer: async (userId) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before reactivating customers.");
        await apiClient.request(backendApi.brand.reactivateCustomer(brandId, userId));
        await get().loadCustomers(brandId);
      },
      changePassword: async (currentPassword, newPassword) => {
        await nibblApi.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },
      createTopupIntent: async (amount) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand before funding wallet.");
        return apiClient.request<{ client_secret: string; payment_intent_id: string }>(
          backendApi.billing.addFunds(brandId),
          { body: { amount } },
        );
      },
      refreshWallet: async () => {
        const brandId = get().selectedBrandId;
        if (!brandId) return;
        const [wallet, transactions] = await Promise.all([
          apiClient.request<ApiRecord>(backendApi.brand.wallet(brandId)),
          apiClient.request<unknown>(backendApi.brand.walletTransactions(brandId)),
        ]);
        set({ wallet, walletTransactions: listResults(transactions) });
      },
      createSetupIntent: async () => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        return apiClient.request<{ client_secret: string; setup_intent_id: string }>(
          backendApi.billing.setupIntent(brandId),
          { body: {} },
        );
      },
      loadSavedCards: async () => {
        const brandId = get().selectedBrandId;
        if (!brandId) return [];
        return apiClient.request<SavedCard[]>(backendApi.billing.savedCards(brandId));
      },
      getAutoRefill: async () => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        return apiClient.request<AutoRefillConfig>(backendApi.billing.autoRefill(brandId));
      },
      saveAutoRefill: async (config) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        return apiClient.request<AutoRefillConfig>(
          backendApi.billing.setAutoRefill(brandId),
          { body: config },
        );
      },
      redeemPromoCode: async (code) => {
        const brandId = get().selectedBrandId;
        if (!brandId) throw new Error("Select a brand first.");
        const result = await apiClient.request<ApiRecord>(
          backendApi.billing.redeemPromo(brandId),
          { body: { code } },
        );
        await get().refreshWallet();
        return result;
      },
      markAllNotificationsRead: async () => {
        await nibblApi.markAllNotificationsRead();
        set({ notifications: [] });
      },
      logout: async () => {
        const refresh = tokenStorage.getRefresh();
        if (refresh) {
          try {
            await nibblApi.logout(refresh);
          } catch {
            // Local token cleanup still needs to happen if the network call fails.
          }
        }
        tokenStorage.clear();
        set({
          accessToken: null,
          refreshToken: null,
          profile: null,
          selectedBrandId: null,
          brands: [],
          brandApplications: [],
          brand: null,
          wallet: null,
          walletTransactions: [],
          products: [],
          campaigns: [],
          reviewCampaigns: [],
          redemptions: [],
          reviewQueue: [],
          reviews: [],
          customers: [],
          analyticsOverview: null,
          analyticsRebatesSummary: null,
          analyticsDashboard: null,
          analyticsCampaigns: [],
          analyticsProducts: [],
          members: [],
          notifications: [],
        });
      },
    }),
    {
      name: "nibbl-brand-api",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        selectedBrandId: state.selectedBrandId,
      }),
    }
  )
);
