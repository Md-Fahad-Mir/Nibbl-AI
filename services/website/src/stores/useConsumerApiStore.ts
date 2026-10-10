"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackApprovedRedemptions, trackPixel } from "@/lib/metaPixel";
import {
  ApiError,
  ApiRecord,
  backendApi,
  nibblApi,
  apiClient,
  tokenStorage,
} from "@/lib/api/backendApi";

export type LoadState = "idle" | "loading" | "success" | "error";

export interface PaginationState {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  pageSize: number;
}

export interface ConsumerApiState {
  accessToken: string | null;
  refreshToken: string | null;
  pendingEmail: string | null;
  user: ApiRecord | null;
  wallet: ApiRecord | null;
  offers: ApiRecord[];
  /** Saved discovery location; null = none yet (ask before showing deals). */
  discoveryLocation: { zip: string; state: string } | null;
  saveDiscoveryLocation: (body: { zip?: string; lat?: number; lng?: number }) => Promise<void>;
  offerPagination: PaginationState;
  selectedOffer: ApiRecord | null;
  savedOffers: ApiRecord[];
  categories: string[];
  reservations: ApiRecord[];
  receipts: ApiRecord[];
  activities: ApiRecord[];
  reviewOpportunities: ApiRecord[];
  redemptions: ApiRecord[];
  payoutMethods: ApiRecord[];
  notifications: ApiRecord[];
  notificationPreferences: ApiRecord | null;
  unreadCount: number;
  config: ApiRecord | null;
  status: LoadState;
  error: string | null;
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  loadProfile: () => Promise<void>;
  /** Sends the code; resolves to the normalized number it was sent to. */
  addPhone: (phone: string, country?: string) => Promise<string>;
  verifyPhone: (code: string) => Promise<void>;
  loadHome: (search?: string, category?: string, page?: number) => Promise<void>;
  loadOfferDetails: (campaignId: string) => Promise<void>;
  loadSavedOffers: () => Promise<void>;
  loadRewardsHub: () => Promise<void>;
  loadWallet: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  updateProfile: (body: ApiRecord | FormData) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  saveOffer: (campaignId: string) => Promise<ApiRecord>;
  claimOffer: (
    campaignId: string,
    consents?: { consent_nibbl?: boolean; consent_brand?: boolean }
  ) => Promise<ApiRecord>;
  uploadReceipt: (reservationId: string, file: File) => Promise<ApiRecord>;
  submitReview: (
    sessionId: string,
    body: { rating: number; title?: string; content?: string; would_recommend?: boolean | null }
  ) => Promise<ApiRecord>;
  inviteFriend: (fullName: string, contact: string) => Promise<void>;
  createPayoutMethod: (provider: "paypal" | "venmo", handle: string) => Promise<ApiRecord>;
  sendWithdrawalCode: (payoutMethodId: string, amount: string) => Promise<{ phone: string }>;
  requestWithdrawal: (payoutMethodId: string, amount: string, code?: string) => Promise<ApiRecord>;
  updateNotificationPreferences: (body: ApiRecord) => Promise<void>;
}

const listResults = (response: unknown): ApiRecord[] => {
  if (Array.isArray(response)) return response as ApiRecord[];
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { results?: unknown }).results)
  ) {
    return (response as { results: ApiRecord[] }).results;
  }
  return [];
};

const paginationMeta = (response: unknown, page: number): PaginationState => {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const record = response as {
      count?: unknown;
      next?: unknown;
      previous?: unknown;
      results?: unknown;
    };

    return {
      count: Number(record.count ?? 0),
      next: typeof record.next === "string" ? record.next : null,
      previous: typeof record.previous === "string" ? record.previous : null,
      page,
      pageSize: OFFER_PAGE_SIZE,
    };
  }

  return {
    count: Array.isArray(response) ? response.length : 0,
    next: null,
    previous: null,
    page,
    pageSize: Array.isArray(response) && response.length ? response.length : OFFER_PAGE_SIZE,
  };
};

const readError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

const roleValue = (profile: ApiRecord | null | undefined) =>
  String(profile?.role ?? "").trim().toLowerCase();

const isConsumerProfile = (profile: ApiRecord | null | undefined) =>
  roleValue(profile) === "consumer" || roleValue(profile) === "customer";

const consumerAccessError =
  "This account is not a customer account. Please use the correct portal for this user.";

const optionalListResponse = async (
  request: Promise<unknown>
): Promise<unknown> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
};

const OFFER_PAGE_SIZE = 20;

export const useConsumerApiStore = create<ConsumerApiState>()(
  persist(
    (set, get) => ({
      accessToken: tokenStorage.getAccess(),
      refreshToken: tokenStorage.getRefresh(),
      pendingEmail: null,
      user: null,
      wallet: null,
      offers: [],
      discoveryLocation: null,
      offerPagination: {
        count: 0,
        next: null,
        previous: null,
        page: 1,
        pageSize: OFFER_PAGE_SIZE,
      },
      selectedOffer: null,
      savedOffers: [],
      categories: [],
      reservations: [],
      receipts: [],
      activities: [],
      reviewOpportunities: [],
      redemptions: [],
      payoutMethods: [],
      notifications: [],
      notificationPreferences: null,
      unreadCount: 0,
      config: null,
      status: "idle",
      error: null,
      setTokens: (access, refresh) => {
        tokenStorage.set(access, refresh);
        set({ accessToken: access, refreshToken: refresh });
      },
      clearAuth: () => {
        tokenStorage.clear();
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          wallet: null,
          offers: [],
          discoveryLocation: null,
          offerPagination: {
            count: 0,
            next: null,
            previous: null,
            page: 1,
            pageSize: OFFER_PAGE_SIZE,
          },
          selectedOffer: null,
          savedOffers: [],
          reservations: [],
          receipts: [],
          activities: [],
          reviewOpportunities: [],
          redemptions: [],
          payoutMethods: [],
          notifications: [],
          unreadCount: 0,
        });
      },
      login: async (email, password, rememberMe = false) => {
        set({ status: "loading", error: null });
        try {
          const tokens = await nibblApi.login({
            email,
            password,
            remember_me: rememberMe,
          });
          get().setTokens(tokens.access, tokens.refresh);
          const user = await nibblApi.me();
          if (!isConsumerProfile(user)) {
            get().clearAuth();
            throw new Error(consumerAccessError);
          }
          set({ user, status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      register: async (fullName, email, password) => {
        set({ status: "loading", error: null });
        try {
          await nibblApi.register({
            full_name: fullName,
            email,
            password,
            accept_terms: true,
          });
          set({ pendingEmail: email, status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      verifyEmail: async (code) => {
        const email = get().pendingEmail;
        if (!email) throw new Error("No email is waiting for verification.");
        set({ status: "loading", error: null });
        try {
          const user = await nibblApi.verifyEmail({ email, code });
          set({ user, status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      resendEmailVerification: async () => {
        const email = get().pendingEmail;
        if (!email) return;
        await nibblApi.resendEmailVerification(email);
      },
      forgotPassword: async (email) => {
        set({ status: "loading", error: null });
        try {
          await nibblApi.forgotPassword(email);
          set({ pendingEmail: email, status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      resetPassword: async (code, newPassword) => {
        const email = get().pendingEmail;
        if (!email) throw new Error("No email is waiting for password reset.");
        set({ status: "loading", error: null });
        try {
          await nibblApi.resetPassword({ email, code, new_password: newPassword });
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      logout: async () => {
        const refresh = get().refreshToken;
        try {
          if (refresh) await nibblApi.logout(refresh);
        } finally {
          get().clearAuth();
        }
      },
      validateSession: async () => {
        set({ status: "loading", error: null });
        try {
          const user = await nibblApi.me();
          if (!isConsumerProfile(user)) {
            get().clearAuth();
            set({ status: "error", error: consumerAccessError });
            return false;
          }
          set({ user, status: "success" });
          return true;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            get().clearAuth();
            return false;
          }

          set({ status: "error", error: readError(error) });
          return true;
        }
      },
      addPhone: async (phone, country) => {
        const result = await nibblApi.addPhone(phone, country);
        return result?.phone || phone;
      },
      verifyPhone: async (code) => {
        // Returns the updated user (phone + is_phone_verified).
        const user = await nibblApi.verifyPhone(code);
        set({ user });
      },
      loadProfile: async () => {
        set({ status: "loading", error: null });
        try {
          const user = await nibblApi.me();
          if (!isConsumerProfile(user)) {
            get().clearAuth();
            set({ status: "error", error: consumerAccessError });
            return;
          }
          const notificationPreferences = await nibblApi.notificationPreferences();
          set({ user, notificationPreferences, status: "success" });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            get().clearAuth();
            return;
          }

          set({ status: "error", error: readError(error) });
        }
      },
      loadHome: async (search, category, page = 1) => {
        set({ status: "loading", error: null });
        try {
          const [wallet, offers, categories, unread, config, location] = await Promise.all([
            nibblApi.wallet(),
            nibblApi.offers({
              page,
              search,
              category: category === "All" ? undefined : category,
            }),
            nibblApi.offerCategories(),
            nibblApi.unreadCount(),
            nibblApi.config(),
            nibblApi.discoveryLocation().catch(() => ({ location: null })),
          ]);
          set({
            wallet,
            discoveryLocation: location.location,
            offers: listResults(offers),
            offerPagination: paginationMeta(offers, page),
            categories: ["All", ...categories.map((item) => String(item.category || "")).filter(Boolean)],
            unreadCount: Number(unread.unread_count || 0),
            config,
            status: "success",
          });
        } catch (error) {
          if (
            page > 1 &&
            error instanceof ApiError &&
            error.message.toLowerCase().includes("invalid page")
          ) {
            await get().loadHome(search, category, 1);
            return;
          }
          set({ status: "error", error: readError(error) });
        }
      },
      saveDiscoveryLocation: async (body) => {
        const saved = await nibblApi.saveDiscoveryLocation(body);
        set({ discoveryLocation: saved.location });
        await get().loadHome();
      },
      loadOfferDetails: async (campaignId) => {
        set({ status: "loading", error: null });
        try {
          const details = await nibblApi.offerDetails(campaignId);
          set({ selectedOffer: details, status: "success" });
          trackPixel(details.meta_pixel_id, "CampaignView", { campaign_id: campaignId });
        } catch {
          try {
            const detail = await nibblApi.offerDetail(campaignId);
            set({ selectedOffer: detail, status: "success" });
            trackPixel(detail.meta_pixel_id, "CampaignView", { campaign_id: campaignId });
          } catch (fallbackError) {
            set({ status: "error", error: readError(fallbackError) });
          }
        }
      },
      loadSavedOffers: async () => {
        set({ status: "loading", error: null });
        try {
          const savedOffers = await nibblApi.savedOffers();
          set({ savedOffers: listResults(savedOffers), status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
        }
      },
      loadRewardsHub: async () => {
        set({ status: "loading", error: null });
        try {
          // Review opportunities are the backend's review sessions only
          // (created from verified receipts by an active review campaign).
          const [reservations, reviewOpportunities, receipts, activities] =
            await Promise.all([
              nibblApi.reservations({ status: "active", page: 1 }),
              optionalListResponse(nibblApi.reviewOpportunities()),
              nibblApi.receipts({ page: 1 }),
              nibblApi.activity({ page: 1 }),
            ]);
          const receiptList = listResults(receipts);
          const pendingUnuploaded = listResults(reservations).filter(
            (reservation) => reservation.receipt_status === null
          );
          set({
            reservations: pendingUnuploaded,
            reviewOpportunities: listResults(reviewOpportunities),
            receipts: receiptList,
            activities: listResults(activities),
            status: "success",
          });
        } catch (error) {
          set({ status: "error", error: readError(error) });
        }
      },
      loadNotifications: async () => {
        set({ status: "loading", error: null });
        try {
          const [notifications, unread] = await Promise.all([
            nibblApi.notifications({ page: 1 }),
            nibblApi.unreadCount(),
          ]);
          set({
            notifications: listResults(notifications),
            unreadCount: Number(unread.unread_count || 0),
            status: "success",
          });
        } catch (error) {
          set({ status: "error", error: readError(error) });
        }
      },
      updateProfile: async (body) => {
        set({ status: "loading", error: null });
        try {
          const user = await nibblApi.updateMe(body);
          set({ user, status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      changePassword: async (currentPassword, newPassword) => {
        set({ status: "loading", error: null });
        try {
          await nibblApi.changePassword({
            current_password: currentPassword,
            new_password: newPassword,
          });
          set({ status: "success" });
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      saveOffer: async (campaignId) => {
        set({ status: "loading", error: null });
        try {
          const saved = await nibblApi.saveOffer(campaignId);
          await get().loadSavedOffers();
          set({ status: "success", error: null });
          return saved;
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      loadWallet: async () => {
        set({ status: "loading", error: null });
        try {
          const [wallet, redemptions, payoutMethods] = await Promise.all([
            nibblApi.wallet(),
            nibblApi.redemptions({ page: 1 }),
            nibblApi.payoutMethods(),
          ]);
          set({
            wallet,
            redemptions: listResults(redemptions),
            payoutMethods: listResults(payoutMethods),
            status: "success",
          });
          trackApprovedRedemptions(listResults(redemptions));
        } catch (error) {
          set({ status: "error", error: readError(error) });
        }
      },
      claimOffer: async (campaignId, consents = {}) => {
        set({ status: "loading", error: null });
        try {
          const reservation = await nibblApi.createReservation(campaignId, consents);
          const offer = [get().selectedOffer, ...get().offers].find(
            (item) => item && String(item.campaign_id ?? item.id) === campaignId
          );
          trackPixel(offer?.meta_pixel_id, "Claim", { campaign_id: campaignId });
          await get().loadRewardsHub();
          set({ status: "success", error: null });
          return reservation;
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      uploadReceipt: async (reservationId, file) => {
        set({ status: "loading", error: null });
        try {
          const receipt = await nibblApi.uploadReceipt(reservationId, file);
          await get().loadRewardsHub();
          if (receipt.status === "verified") await get().loadWallet();
          set({ status: "success", error: null });
          return receipt;
        } catch (error) {
          set({ status: "error", error: readError(error) });
          throw error;
        }
      },
      submitReview: async (sessionId, body) => {
        const review = await nibblApi.submitReview(sessionId, body);
        await Promise.all([get().loadRewardsHub(), get().loadWallet()]);
        return review;
      },
      inviteFriend: async (fullName, contact) => {
        await nibblApi.inviteReferral({ full_name: fullName, contact });
      },
      createPayoutMethod: async (provider, handle) => {
        const payoutMethod = await nibblApi.createPayoutMethod({
          provider,
          handle,
          is_default: true,
        });
        await get().loadWallet();
        return payoutMethod;
      },
      sendWithdrawalCode: async (payoutMethodId, amount) => {
        return nibblApi.sendWithdrawalCode({ payout_method: payoutMethodId, amount });
      },
      requestWithdrawal: async (payoutMethodId, amount, code) => {
        if (Number(amount) < 0.01) {
          throw new Error("You need at least $0.01 available before requesting a withdrawal.");
        }
        const withdrawal = await nibblApi.createWithdrawal({
          payout_method: payoutMethodId,
          amount,
          ...(code ? { code } : {}),
        });
        await get().loadWallet();
        return withdrawal;
      },
      updateNotificationPreferences: async (body) => {
        const notificationPreferences =
          await apiClient.request<ApiRecord>(
            backendApi.consumer.updateNotificationPreferences,
            { body }
          );
        set({ notificationPreferences });
      },
    }),
    {
      name: "nibbl-consumer-api",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        pendingEmail: state.pendingEmail,
        user: state.user,
      }),
    }
  )
);
