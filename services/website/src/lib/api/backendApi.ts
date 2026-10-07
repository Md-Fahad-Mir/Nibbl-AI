export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  auth: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ApiRecord = Record<string, unknown>;

const API_PREFIX = "/api/v1";

const normalizeBaseUrl = (value?: string) => {
  const fallback = "https://api.joinnibbl.com";
  const raw = (value || fallback).replace(/\/+$/, "");
  return raw.endsWith(API_PREFIX) ? raw : `${raw}${API_PREFIX}`;
};

export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_NIBBLAI_API_BASE_URL
);

export const backendApi = {
  common: {
    health: { method: "GET", path: "/health/", auth: false },
    config: { method: "GET", path: "/config/", auth: false },
  },
  content: {
    faqs: { method: "GET", path: "/faqs/", auth: false },
    terms: { method: "GET", path: "/content/terms/", auth: false },
    privacyPolicy: {
      method: "GET",
      path: "/content/privacy-policy/",
      auth: false,
    },
  },
  auth: {
    register: { method: "POST", path: "/auth/register/", auth: false },
    login: { method: "POST", path: "/auth/login/", auth: false },
    logout: { method: "POST", path: "/auth/logout/", auth: true },
    refresh: { method: "POST", path: "/auth/token/refresh/", auth: false },
    verifyEmail: { method: "POST", path: "/auth/verify-email/", auth: false },
    resendEmailVerification: {
      method: "POST",
      path: "/auth/resend-email-verification/",
      auth: false,
    },
    forgotPassword: {
      method: "POST",
      path: "/auth/password/forgot/",
      auth: false,
    },
    resetPassword: {
      method: "POST",
      path: "/auth/password/reset/",
      auth: false,
    },
    social: { method: "POST", path: "/auth/social/", auth: false },
  },
  users: {
    me: { method: "GET", path: "/users/me/", auth: true },
    updateMe: { method: "PATCH", path: "/users/me/", auth: true },
    deleteMe: { method: "DELETE", path: "/users/me/", auth: true },
    changePassword: {
      method: "POST",
      path: "/users/me/change-password/",
      auth: true,
    },
    addPhone: { method: "POST", path: "/users/me/phone/", auth: true },
    verifyPhone: { method: "POST", path: "/users/me/phone/verify/", auth: true },
    referrals: { method: "GET", path: "/users/me/referrals/", auth: true },
    inviteReferral: {
      method: "POST",
      path: "/users/me/referrals/invite/",
      auth: true,
    },
  },
  consumer: {
    offers: { method: "GET", path: "/offers/", auth: true },
    offerCategories: { method: "GET", path: "/offers/categories/", auth: true },
    savedOffers: { method: "GET", path: "/offers/saved/", auth: true },
    offerDetail: (campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/offers/${campaignId}/`,
      auth: true,
    }),
    offerDetails: (campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/offers/${campaignId}/details/`,
      auth: true,
    }),
    offerByUrl: (token: string): ApiEndpoint => ({
      method: "GET",
      path: `/offers/by-url/${token}/`,
      auth: false,
    }),
    offerByQr: (token: string): ApiEndpoint => ({
      method: "GET",
      path: `/offers/by-qr/${token}/`,
      auth: false,
    }),
    saveOffer: (campaignId: string): ApiEndpoint => ({
      method: "POST",
      path: `/offers/${campaignId}/save/`,
      auth: true,
    }),
    bookmarks: { method: "GET", path: "/bookmarks/", auth: true },
    addBookmark: { method: "POST", path: "/bookmarks/", auth: true },
    removeBookmark: (bookmarkId: string): ApiEndpoint => ({
      method: "DELETE",
      path: `/bookmarks/${bookmarkId}/`,
      auth: true,
    }),
    reservations: { method: "GET", path: "/reservations/", auth: true },
    createReservation: {
      method: "POST",
      path: "/reservations/",
      auth: true,
    },
    reservationDetail: (reservationId: string): ApiEndpoint => ({
      method: "GET",
      path: `/reservations/${reservationId}/`,
      auth: true,
    }),
    receipts: { method: "GET", path: "/receipts/", auth: true },
    uploadReceipt: { method: "POST", path: "/receipts/", auth: true },
    receiptDetail: (receiptId: string): ApiEndpoint => ({
      method: "GET",
      path: `/receipts/${receiptId}/`,
      auth: true,
    }),
    reviewOpportunities: {
      method: "GET",
      path: "/reviews/opportunities/",
      auth: true,
    },
    reviewSession: (sessionId: string): ApiEndpoint => ({
      method: "GET",
      path: `/reviews/sessions/${sessionId}/`,
      auth: true,
    }),
    answerReview: (sessionId: string): ApiEndpoint => ({
      method: "POST",
      path: `/reviews/sessions/${sessionId}/answer/`,
      auth: true,
    }),
    submitReview: (sessionId: string): ApiEndpoint => ({
      method: "POST",
      path: `/reviews/sessions/${sessionId}/submit/`,
      auth: true,
    }),
    myReviews: { method: "GET", path: "/reviews/", auth: true },
    productReviews: (productId: string): ApiEndpoint => ({
      method: "GET",
      path: `/products/${productId}/reviews/`,
      auth: true,
    }),
    productReviewSummary: (productId: string): ApiEndpoint => ({
      method: "GET",
      path: `/products/${productId}/review-summary/`,
      auth: true,
    }),
    wallet: { method: "GET", path: "/wallet/", auth: true },
    walletTransactions: {
      method: "GET",
      path: "/wallet/transactions/",
      auth: true,
    },
    walletStatement: {
      method: "GET",
      path: "/wallet/statement/",
      auth: true,
    },
    activity: { method: "GET", path: "/activity/", auth: true },
    redemptions: { method: "GET", path: "/redemptions/", auth: true },
    redemptionDetail: (redemptionId: string): ApiEndpoint => ({
      method: "GET",
      path: `/redemptions/${redemptionId}/`,
      auth: true,
    }),
    payoutMethods: { method: "GET", path: "/payout-methods/", auth: true },
    createPayoutMethod: {
      method: "POST",
      path: "/payout-methods/",
      auth: true,
    },
    deletePayoutMethod: (methodId: string): ApiEndpoint => ({
      method: "DELETE",
      path: `/payout-methods/${methodId}/`,
      auth: true,
    }),
    withdrawals: { method: "GET", path: "/withdrawals/", auth: true },
    createWithdrawal: {
      method: "POST",
      path: "/withdrawals/",
      auth: true,
    },
    withdrawalDetail: (withdrawalId: string): ApiEndpoint => ({
      method: "GET",
      path: `/withdrawals/${withdrawalId}/`,
      auth: true,
    }),
    notifications: { method: "GET", path: "/notifications/", auth: true },
    unreadCount: {
      method: "GET",
      path: "/notifications/unread-count/",
      auth: true,
    },
    markNotificationRead: (notificationId: string): ApiEndpoint => ({
      method: "POST",
      path: `/notifications/${notificationId}/read/`,
      auth: true,
    }),
    markAllNotificationsRead: {
      method: "POST",
      path: "/notifications/read-all/",
      auth: true,
    },
    notificationPreferences: {
      method: "GET",
      path: "/notification-preferences/",
      auth: true,
    },
    updateNotificationPreferences: {
      method: "PATCH",
      path: "/notification-preferences/",
      auth: true,
    },
    deviceTokens: { method: "GET", path: "/device-tokens/", auth: true },
    createDeviceToken: { method: "POST", path: "/device-tokens/", auth: true },
    deleteDeviceToken: (tokenId: string): ApiEndpoint => ({
      method: "DELETE",
      path: `/device-tokens/${tokenId}/`,
      auth: true,
    }),
  },
  brand: {
    applications: {
      method: "GET",
      path: "/brand-applications/",
      auth: true,
    },
    createApplication: {
      method: "POST",
      path: "/brand-applications/",
      auth: true,
    },
    applicationDetail: (applicationId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brand-applications/${applicationId}/`,
      auth: true,
    }),
    brands: { method: "GET", path: "/brands/", auth: true },
    brandDetail: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/`,
      auth: true,
    }),
    members: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/members/`,
      auth: true,
    }),
    addMember: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/members/`,
      auth: true,
    }),
    removeMember: (brandId: string, membershipId: string): ApiEndpoint => ({
      method: "DELETE",
      path: `/brands/${brandId}/members/${membershipId}/`,
      auth: true,
    }),
    customers: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/customers/`,
      auth: true,
    }),
    products: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/products/`,
      auth: true,
    }),
    createProduct: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/products/`,
      auth: true,
    }),
    productDetail: (brandId: string, productId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/products/${productId}/`,
      auth: true,
    }),
    matchProducts: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/products/match/`,
      auth: true,
    }),
    productAliases: (brandId: string, productId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/products/${productId}/aliases/`,
      auth: true,
    }),
    createProductAlias: (brandId: string, productId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/products/${productId}/aliases/`,
      auth: true,
    }),
    deleteProductAlias: (
      brandId: string,
      productId: string,
      aliasId: string
    ): ApiEndpoint => ({
      method: "DELETE",
      path: `/brands/${brandId}/products/${productId}/aliases/${aliasId}/`,
      auth: true,
    }),
    tags: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/tags/`,
      auth: true,
    }),
    generateTags: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/tags/generate/`,
      auth: true,
    }),
    campaigns: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/`,
      auth: true,
    }),
    createCampaign: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/campaigns/`,
      auth: true,
    }),
    campaignDetail: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/${campaignId}/`,
      auth: true,
    }),
    campaignTiers: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/${campaignId}/tiers/`,
      auth: true,
    }),
    campaignFallback: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/${campaignId}/fallback/`,
      auth: true,
    }),
    campaignAccess: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/${campaignId}/access/`,
      auth: true,
    }),
    campaignPreview: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/campaigns/${campaignId}/preview/`,
      auth: true,
    }),
    activateCampaign: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/campaigns/${campaignId}/activate/`,
      auth: true,
    }),
    pauseCampaign: (brandId: string, campaignId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/campaigns/${campaignId}/pause/`,
      auth: true,
    }),
    wallet: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/wallet/`,
      auth: true,
    }),
    walletTransactions: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/wallet/transactions/`,
      auth: true,
    }),
    fundWallet: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/wallet/fund/`,
      auth: true,
    }),
    reviewQueue: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/review-queue/`,
      auth: true,
    }),
    approveReviewQueueItem: (brandId: string, itemId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/review-queue/${itemId}/approve/`,
      auth: true,
    }),
    declineReviewQueueItem: (brandId: string, itemId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/review-queue/${itemId}/decline/`,
      auth: true,
    }),
    addAliasFromReviewQueue: (brandId: string, itemId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/review-queue/${itemId}/add-alias/`,
      auth: true,
    }),
    flagUser: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/flag-user/`,
      auth: true,
    }),
    redemptions: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/redemptions/`,
      auth: true,
    }),
    reviewCampaigns: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/review-campaigns/`,
      auth: true,
    }),
    createReviewCampaign: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/review-campaigns/`,
      auth: true,
    }),
    reviews: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/reviews/`,
      auth: true,
    }),
    removeReview: (brandId: string, reviewId: string): ApiEndpoint => ({
      method: "POST",
      path: `/brands/${brandId}/reviews/${reviewId}/remove/`,
      auth: true,
    }),
    analyticsOverview: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/analytics/overview/`,
      auth: true,
    }),
    analyticsCampaigns: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/analytics/campaigns/`,
      auth: true,
    }),
    analyticsProducts: (brandId: string): ApiEndpoint => ({
      method: "GET",
      path: `/brands/${brandId}/analytics/products/`,
      auth: true,
    }),
  },
  admin: {
    users: { method: "GET", path: "/admin/users/", auth: true },
    creditUserWallet: (userId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/users/${userId}/wallet/credit/`,
      auth: true,
    }),
    suspendUser: (userId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/users/${userId}/suspend/`,
      auth: true,
    }),
    reactivateUser: (userId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/users/${userId}/reactivate/`,
      auth: true,
    }),
    brandApplications: {
      method: "GET",
      path: "/admin/brand-applications/",
      auth: true,
    },
    approveBrandApplication: (applicationId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brand-applications/${applicationId}/approve/`,
      auth: true,
    }),
    rejectBrandApplication: (applicationId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brand-applications/${applicationId}/reject/`,
      auth: true,
    }),
    brands: { method: "GET", path: "/admin/brands/", auth: true },
    suspendBrand: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brands/${brandId}/suspend/`,
      auth: true,
    }),
    reactivateBrand: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brands/${brandId}/reactivate/`,
      auth: true,
    }),
    creditBrandWallet: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brands/${brandId}/wallet/credit/`,
      auth: true,
    }),
    changeBrandPlan: (brandId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/brands/${brandId}/plan/`,
      auth: true,
    }),
    fraudFlags: { method: "GET", path: "/admin/fraud-flags/", auth: true },
    campaigns: { method: "GET", path: "/admin/campaigns/", auth: true },
    transactions: {
      method: "GET",
      path: "/admin/transactions/",
      auth: true,
    },
    heldReviews: { method: "GET", path: "/admin/reviews/held/", auth: true },
    removeReview: (reviewId: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/reviews/${reviewId}/remove/`,
      auth: true,
    }),
    auditLogs: { method: "GET", path: "/admin/audit-logs/", auth: true },
    announcements: {
      method: "POST",
      path: "/admin/announcements/",
      auth: true,
    },
    roleStatistics: {
      method: "GET",
      path: "/admin/role-statistics/",
      auth: true,
    },
    withdrawals: { method: "GET", path: "/admin/withdrawals/", auth: true },
    withdrawalAction: (withdrawalId: string, action: string): ApiEndpoint => ({
      method: "POST",
      path: `/admin/withdrawals/${withdrawalId}/${action}/`,
      auth: true,
    }),
    payoutBatches: {
      method: "GET",
      path: "/admin/payout-batches/",
      auth: true,
    },
    createPayoutBatch: {
      method: "POST",
      path: "/admin/payout-batches/",
      auth: true,
    },
    exportPayoutBatch: (batchId: string): ApiEndpoint => ({
      method: "GET",
      path: `/admin/payout-batches/${batchId}/export/`,
      auth: true,
    }),
    analyticsOverview: {
      method: "GET",
      path: "/admin/analytics/overview/",
      auth: true,
    },
    analyticsSnapshots: {
      method: "GET",
      path: "/admin/analytics/snapshots/",
      auth: true,
    },
    faqs: { method: "GET", path: "/admin/faqs/", auth: true },
    createFaq: { method: "POST", path: "/admin/faqs/", auth: true },
    faqDetail: (faqId: string): ApiEndpoint => ({
      method: "GET",
      path: `/admin/faqs/${faqId}/`,
      auth: true,
    }),
    terms: { method: "GET", path: "/admin/content/terms/", auth: true },
    updateTerms: {
      method: "PATCH",
      path: "/admin/content/terms/",
      auth: true,
    },
    privacyPolicy: {
      method: "GET",
      path: "/admin/content/privacy-policy/",
      auth: true,
    },
    updatePrivacyPolicy: {
      method: "PATCH",
      path: "/admin/content/privacy-policy/",
      auth: true,
    },
  },
  billing: {
    plans: { method: "GET", path: "/plans/", auth: true },
    planDetail: (planId: string): ApiEndpoint => ({
      method: "GET",
      path: `/plans/${planId}/`,
      auth: true,
    }),
  },
} as const;

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(extractApiErrorMessage(data) || `Request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const extractApiErrorMessage = (data: unknown): string => {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  const firstKey = Object.keys(record)[0];
  const firstValue = record[firstKey];
  if (Array.isArray(firstValue) && firstValue.length > 0) {
    return String(firstValue[0]);
  }
  if (typeof firstValue === "string") return firstValue;
  return "";
};

const storageAvailable = () => typeof window !== "undefined";

export const tokenStorage = {
  getAccess: () => (storageAvailable() ? localStorage.getItem("nibbl_access") : null),
  getRefresh: () => (storageAvailable() ? localStorage.getItem("nibbl_refresh") : null),
  set: (access: string, refresh: string) => {
    if (!storageAvailable()) return;
    localStorage.setItem("nibbl_access", access);
    localStorage.setItem("nibbl_refresh", refresh);
  },
  clear: () => {
    if (!storageAvailable()) return;
    localStorage.removeItem("nibbl_access");
    localStorage.removeItem("nibbl_refresh");
  },
};

const buildUrl = (
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const textResponseMessage = (response: Response, text: string) => {
  const trimmed = text.trim();
  const fallback = response.statusText || `Request failed with ${response.status}`;

  if (!trimmed || trimmed.startsWith("<")) return fallback;
  if ((response.headers.get("content-type") || "").includes("text/html")) return fallback;

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
};

const readResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204 || response.status === 205) return null;
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return text ? { detail: textResponseMessage(response, text) } : null;
};

export const apiClient = {
  async request<T>(endpoint: ApiEndpoint, options: RequestOptions = {}): Promise<T> {
    const method = options.method || endpoint.method;
    const headers = new Headers(options.headers);
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if ((options.auth ?? endpoint.auth) && !headers.has("Authorization")) {
      const access = tokenStorage.getAccess();
      if (access) headers.set("Authorization", `Bearer ${access}`);
    }

    const response = await fetch(buildUrl(endpoint.path, options.query), {
      method,
      headers,
      body: isFormData
        ? (options.body as BodyInit)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });

    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return this.request<T>(endpoint, {
          ...options,
          retryOnUnauthorized: false,
        });
      }
    }

    const data = await readResponseBody(response);
    if (!response.ok) throw new ApiError(response.status, data);
    return data as T;
  },
};

export const refreshAccessToken = async () => {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return false;

  try {
    const tokens = await apiClient.request<{ access: string; refresh?: string }>(
      backendApi.auth.refresh,
      {
        body: { refresh },
        auth: false,
        retryOnUnauthorized: false,
      }
    );
    tokenStorage.set(tokens.access, tokens.refresh || refresh);
    return true;
  } catch {
    tokenStorage.clear();
    return false;
  }
};

const requestEndpoint = <T>(
  endpoint: ApiEndpoint,
  body?: unknown,
  query?: RequestOptions["query"]
) => apiClient.request<T>(endpoint, { body, query });

export const nibblApi = {
  login: (body: { email: string; password: string; remember_me?: boolean }) =>
    requestEndpoint<{ access: string; refresh: string }>(backendApi.auth.login, body),
  register: (body: {
    full_name: string;
    email: string;
    password: string;
    accept_terms: boolean;
    referral_code?: string;
  }) => requestEndpoint<ApiRecord>(backendApi.auth.register, body),
  verifyEmail: (body: { email: string; code: string }) =>
    requestEndpoint<ApiRecord>(backendApi.auth.verifyEmail, body),
  resendEmailVerification: (email: string) =>
    requestEndpoint<ApiRecord>(backendApi.auth.resendEmailVerification, { email }),
  forgotPassword: (email: string) =>
    requestEndpoint<ApiRecord>(backendApi.auth.forgotPassword, { email }),
  resetPassword: (body: { email: string; code: string; new_password: string }) =>
    requestEndpoint<ApiRecord>(backendApi.auth.resetPassword, body),
  logout: (refresh: string) =>
    requestEndpoint<null>(backendApi.auth.logout, { refresh }),
  me: () => requestEndpoint<ApiRecord>(backendApi.users.me),
  updateMe: (body: ApiRecord | FormData) =>
    requestEndpoint<ApiRecord>(backendApi.users.updateMe, body),
  changePassword: (body: { current_password: string; new_password: string }) =>
    requestEndpoint<ApiRecord>(backendApi.users.changePassword, body),
  notificationPreferences: () =>
    requestEndpoint<ApiRecord>(backendApi.consumer.notificationPreferences),
  updateNotificationPreferences: (body: ApiRecord) =>
    requestEndpoint<ApiRecord>(
      backendApi.consumer.updateNotificationPreferences,
      body
    ),
  config: () => requestEndpoint<ApiRecord>(backendApi.common.config),
  faqs: () => requestEndpoint<ApiRecord[]>(backendApi.content.faqs),
  terms: () => requestEndpoint<ApiRecord>(backendApi.content.terms),
  privacyPolicy: () =>
    requestEndpoint<ApiRecord>(backendApi.content.privacyPolicy),
  adminFaqs: () => requestEndpoint<ApiRecord[]>(backendApi.admin.faqs),
  createAdminFaq: (body: ApiRecord) =>
    requestEndpoint<ApiRecord>(backendApi.admin.createFaq, body),
  updateAdminFaq: (faqId: string, body: ApiRecord) =>
    apiClient.request<ApiRecord>(backendApi.admin.faqDetail(faqId), {
      method: "PATCH",
      body,
    }),
  deleteAdminFaq: (faqId: string) =>
    apiClient.request<null>(backendApi.admin.faqDetail(faqId), {
      method: "DELETE",
    }),
  adminTerms: () => requestEndpoint<ApiRecord>(backendApi.admin.terms),
  updateAdminTerms: (content: string) =>
    requestEndpoint<ApiRecord>(backendApi.admin.updateTerms, { content }),
  adminPrivacyPolicy: () =>
    requestEndpoint<ApiRecord>(backendApi.admin.privacyPolicy),
  updateAdminPrivacyPolicy: (content: string) =>
    requestEndpoint<ApiRecord>(backendApi.admin.updatePrivacyPolicy, { content }),
  offers: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(backendApi.consumer.offers, undefined, query),
  offerCategories: () =>
    requestEndpoint<ApiRecord[]>(backendApi.consumer.offerCategories),
  savedOffers: () =>
    requestEndpoint<ApiRecord[] | PaginatedResponse<ApiRecord>>(backendApi.consumer.savedOffers),
  offerDetail: (campaignId: string) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.offerDetail(campaignId)),
  offerDetails: (campaignId: string) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.offerDetails(campaignId)),
  saveOffer: (campaignId: string) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.saveOffer(campaignId)),
  createReservation: (campaignId: string) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.createReservation, {
      campaign: campaignId,
    }),
  reservations: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(
      backendApi.consumer.reservations,
      undefined,
      query
    ),
  receipts: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(
      backendApi.consumer.receipts,
      undefined,
      query
    ),
  uploadReceipt: (reservationId: string, image: File) => {
    const form = new FormData();
    form.append("reservation", reservationId);
    form.append("image", image);
    return requestEndpoint<ApiRecord>(backendApi.consumer.uploadReceipt, form);
  },
  reviewOpportunities: () =>
    requestEndpoint<ApiRecord[]>(backendApi.consumer.reviewOpportunities),
  submitReview: (sessionId: string, body: { rating: number; content?: string }) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.submitReview(sessionId), body),
  createReview: (body: {
    product: string;
    answers: { question: string; answer: string }[];
    rating?: number;
  }) =>
    apiClient.request<ApiRecord>(backendApi.consumer.myReviews, {
      method: "POST",
      body,
    }),
  myReviews: () =>
    requestEndpoint<ApiRecord[] | PaginatedResponse<ApiRecord>>(
      backendApi.consumer.myReviews
    ),
  wallet: () => requestEndpoint<ApiRecord>(backendApi.consumer.wallet),
  walletStatement: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(
      backendApi.consumer.walletStatement,
      undefined,
      query
    ),
  redemptions: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(
      backendApi.consumer.redemptions,
      undefined,
      query
    ),
  payoutMethods: () => requestEndpoint<ApiRecord[]>(backendApi.consumer.payoutMethods),
  createPayoutMethod: (body: ApiRecord) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.createPayoutMethod, body),
  createWithdrawal: (body: { payout_method: string; amount: string }) =>
    requestEndpoint<ApiRecord>(backendApi.consumer.createWithdrawal, body),
  activity: (query?: RequestOptions["query"]) =>
    requestEndpoint<PaginatedResponse<ApiRecord>>(
      backendApi.consumer.activity,
      undefined,
      query
    ),
  referrals: () => requestEndpoint<ApiRecord>(backendApi.users.referrals),
  inviteReferral: (body: { full_name: string; contact: string }) =>
    requestEndpoint<ApiRecord>(backendApi.users.inviteReferral, body),
  notifications: (query?: RequestOptions["query"]) =>
    requestEndpoint<ApiRecord[]>(backendApi.consumer.notifications, undefined, query),
  unreadCount: () => requestEndpoint<ApiRecord>(backendApi.consumer.unreadCount),
  markAllNotificationsRead: () =>
    requestEndpoint<ApiRecord>(backendApi.consumer.markAllNotificationsRead),
};
