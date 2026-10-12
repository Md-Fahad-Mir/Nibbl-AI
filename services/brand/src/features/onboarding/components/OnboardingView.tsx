"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./layout/Sidebar";
import Header from "./layout/Header";
import DashboardView from "./dashboard/DashboardView";
import ProductLibraryView from "./product-library/ProductLibraryView";
import ProductDetailsView from "./product-library/ProductDetailsView";
import AddProductView, { ProductFormValues } from "./product-library/AddProductView";
import RebatesView from "./rebates/RebatesView";
import ReviewsView from "./reviews/ReviewsView";
import RedemptionsView from "./redemptions/RedemptionsView";
import SettingsView from "./settings/SettingsView";
import WalletView from "./wallet/WalletView";
import AnalyticsView from "./analytics/AnalyticsView";
import CustomersView from "./customers/CustomersView";
import TagGeneratorView from "./tag-generator/TagGeneratorView";
import PlansView from "./plans/PlansView";
import BrandCheckout from "./checkout/BrandCheckout";
import { Product } from "../utils/mockData";
import { useBrandApiStore } from "@/stores/useBrandApiStore";


type ProductViewMode = "list" | "details" | "add" | "edit";

const activeTabStorageKey = "nibbl-brand-active-tab";
const productViewModeStorageKey = "nibbl-brand-product-view-mode";
const tabs = [
  "Dashboard",
  "Product Library",
  "Rebate",
  "Reviews",
  "Redemptions",
  "Analytics",
  "Customers",
  "Wallet",
  "Plans",
  "Settings",
  "Tag Generator",
];

const readStoredTab = () => {
  if (typeof window === "undefined") return "Dashboard";
  const value = localStorage.getItem(activeTabStorageKey);
  return value && tabs.includes(value) ? value : "Dashboard";
};

const readStoredProductViewMode = (): ProductViewMode => {
  if (typeof window === "undefined") return "list";
  const value = localStorage.getItem(productViewModeStorageKey);
  return value === "add" || value === "edit" || value === "details" || value === "list"
    ? value
    : "list";
};

const productPayload = (product: ProductFormValues) => {
  const body = {
    name: product.name,
    description: product.description,
    category: product.category,
    flavor: product.flavor,
    size_volume: product.size,
    unit: product.unit,
    pack_count: String(product.packCount),
    sku: product.sku,
  };

  if (!product.imageFile) return body;

  const form = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    form.append(key, value);
  });
  form.append("image_url", product.imageFile);
  return form;
};

const productIdsForCampaign = (campaign: Record<string, unknown>) => {
  const rawProducts = campaign.products ?? campaign.product ?? campaign.product_ids;
  const products = Array.isArray(rawProducts) ? rawProducts : rawProducts ? [rawProducts] : [];

  return new Set(
    products
      .map((product) => {
        if (product && typeof product === "object" && "id" in product) {
          return String((product as { id: unknown }).id);
        }
        return String(product || "");
      })
      .filter(Boolean)
  );
};

const isActiveCampaign = (campaign: Record<string, unknown>) =>
  String(campaign.status ?? "").toLowerCase() === "active";

export default function OnboardingView() {
  const router = useRouter();
  const [activeTab, setActiveTabState] = useState(readStoredTab);
  const [viewMode, setViewModeState] = useState<ProductViewMode>(readStoredProductViewMode);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reviewProductFilter, setReviewProductFilter] = useState("");
  const {
    products: apiProducts,
    campaigns: rebateCampaigns,
    reviewCampaigns,
    notifications: apiNotifications,
    loadWorkspace,
    loadProductAliases,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductAliases,
    markAllNotificationsRead,
    wallet,
    accessToken,
    refreshToken,
    selectedBrandId,
    brands,
    brand,
    brandApplications,
    profile,
    status,
    error,
    adminBrandId,
    logout,
  } = useBrandApiStore();

  useEffect(() => {
    if (!accessToken && !refreshToken) {
      router.replace("/login");
      return;
    }
    void loadWorkspace();
  }, [accessToken, refreshToken, loadWorkspace, router]);

  const visibleTab = !selectedBrandId && activeTab !== "Settings" ? "Dashboard" : activeTab;
  // Self-serve signup (Master): an application waiting for checkout, or a
  // rejected one (shown with its reason).
  const checkoutApplication =
    brandApplications.find((application) => application.status === "pending") ??
    brandApplications.find((application) => application.status === "rejected");
  const visibleViewMode =
    selectedProduct || (viewMode !== "details" && viewMode !== "edit") ? viewMode : "list";
  const selectedBrand = brands.find((item) => String(item.id ?? "") === selectedBrandId);
  const workspaceBrandName = String(
    brand?.legal_name ||
      brand?.name ||
      brand?.brand_name ||
      selectedBrand?.legal_name ||
      selectedBrand?.name ||
      selectedBrand?.brand_name ||
      ""
  );
  const productsWithCampaignCounts = useMemo(() => {
    const activeCampaigns = [...rebateCampaigns, ...reviewCampaigns].filter(isActiveCampaign);

    return apiProducts.map((product) => ({
      ...product,
      activeCampaigns: activeCampaigns.filter((campaign) =>
        productIdsForCampaign(campaign).has(product.id)
      ).length,
    }));
  }, [apiProducts, rebateCampaigns, reviewCampaigns]);
  const activeCampaignCountForProduct = (productId: string) =>
    [...rebateCampaigns, ...reviewCampaigns].filter(
      (campaign) => isActiveCampaign(campaign) && productIdsForCampaign(campaign).has(productId)
    ).length;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem(activeTabStorageKey, tab);
    }
  };

  const setViewMode = (mode: ProductViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(productViewModeStorageKey, mode);
    }
  };

  // Callbacks
  const handleAddNew = () => setViewMode("add");
  
  const handleViewDetails = async (prod: Product) => {
    await loadProductAliases(prod.id);
    const latest = useBrandApiStore.getState().products.find((item) => item.id === prod.id);
    const product = latest || prod;
    setSelectedProduct({
      ...product,
      activeCampaigns: activeCampaignCountForProduct(product.id),
    });
    setViewMode("details");
  };

  const handleEditProduct = async (prod: Product) => {
    await loadProductAliases(prod.id);
    const latest = useBrandApiStore.getState().products.find((item) => item.id === prod.id);
    const product = latest || prod;
    setSelectedProduct({
      ...product,
      activeCampaigns: activeCampaignCountForProduct(product.id),
    });
    setViewMode("edit");
  };

  const handleDeleteProduct = (prodId: string) => {
    void deleteProduct(prodId);
    setSelectedProduct(null);
    setViewMode("list");
  };

  const handleViewAllProductCampaigns = (type: "REBATE" | "REVIEW") => {
    setActiveTab(type === "REVIEW" ? "Reviews" : "Rebate");
    setViewMode("list");
    setSelectedProduct(null);
  };

  const handleViewProductReviews = (productId: string) => {
    setReviewProductFilter(productId);
    setActiveTab("Reviews");
    setViewMode("list");
    setSelectedProduct(null);
  };

  const handleSaveProduct = async (newProd: ProductFormValues) => {
    const created = await createProduct(productPayload(newProd));
    if (newProd.aliases.length) {
      await updateProductAliases(created.id, newProd.aliases);
    }
    setViewMode("list");
  };

  const handleUpdateProduct = async (updatedProduct: ProductFormValues) => {
    if (!selectedProduct) return;
    await updateProduct(selectedProduct.id, productPayload(updatedProduct));
    await loadProductAliases(selectedProduct.id);
    await updateProductAliases(selectedProduct.id, updatedProduct.aliases);
    const latest = useBrandApiStore.getState().products.find((product) => product.id === selectedProduct.id);
    setSelectedProduct(latest || selectedProduct);
    setViewMode("details");
  };

  return (
    <div className="flex flex-row min-h-screen bg-[#FAF8FF] font-jakarta w-full">
      <Sidebar 
        activeTab={visibleTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }} 
        setViewMode={setViewMode} 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        hasBrandAccess={Boolean(selectedBrandId)}
      />
      
      <div className="flex-grow min-w-0 flex flex-col relative">
        <Header
          notifications={apiNotifications}
          walletBalance={`$${String(wallet?.reward_available ?? wallet?.available ?? wallet?.balance ?? "0.00")}`}
          onOpenWallet={() => setActiveTab("Wallet")}
          planName={
            brand?.plan && typeof brand.plan === "object"
              ? String((brand.plan as Record<string, unknown>).name ?? "")
              : undefined
          }
          onOpenPlans={() => setActiveTab("Plans")}
          userName={String(profile?.full_name ?? profile?.email ?? "Brand user")}
          userRole={String(profile?.role ?? "brand")}
          avatarUrl={typeof profile?.avatar_url === "string" ? profile.avatar_url : undefined}
          handleMarkAllRead={() => {
            void markAllNotificationsRead();
          }}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenProfile={() => {
            setActiveTab("Settings");
            setViewMode("list");
          }}
        />

        {adminBrandId && (
          <div className="bg-[#001BD2] text-white text-sm px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span>
              ⓘ <b>Nibbl Admin Mode</b> — Viewing {String(brand?.name ?? "this brand")}. Every action is logged.
            </span>
            <button onClick={() => void logout().then(() => window.close())}
              className="text-xs font-bold underline cursor-pointer bg-transparent border-none text-white">Exit Admin Mode</button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-8 flex flex-col gap-12 w-full">
          {status === "error" && error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {!selectedBrandId && status !== "loading" && checkoutApplication ? (
            <BrandCheckout application={checkoutApplication} />
          ) : !selectedBrandId && status !== "loading" ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#001BD2]">
                Brand access pending
              </p>
              <h1 className="text-2xl font-extrabold text-[#131B2E] mt-2">
                Your brand workspace is not active yet.
              </h1>
              <p className="text-sm font-medium text-[#454656] leading-relaxed mt-3">
                {brandApplications.length
                  ? "Your brand application has been submitted."
                  : "No approved brand workspace is connected to this account yet."}
              </p>
            </div>
          ) : (
            <>
              {visibleTab === "Dashboard" && (
                <DashboardView onNavigate={(tab) => { setActiveTab(tab); setViewMode("list"); }} />
              )}
          
              {visibleTab === "Rebate" && <RebatesView onOpenPlans={() => setActiveTab("Plans")} />}
          
              {visibleTab === "Reviews" && (
                <ReviewsView
                  initialProductFilter={reviewProductFilter}
                  onFilterConsumed={() => setReviewProductFilter("")}
                />
              )}
          
              {visibleTab === "Redemptions" && <RedemptionsView />}
          
              {visibleTab === "Settings" && <SettingsView />}

              {visibleTab === "Wallet" && <WalletView />}

              {visibleTab === "Plans" && <PlansView />}

              {visibleTab === "Analytics" && <AnalyticsView />}

              {visibleTab === "Customers" && <CustomersView />}

              {visibleTab === "Tag Generator" && <TagGeneratorView />}

              {visibleTab === "Product Library" && visibleViewMode === "list" && (
                <ProductLibraryView
                  products={productsWithCampaignCounts}
                  onViewDetails={handleViewDetails}
                  onEditProduct={handleEditProduct}
                  onViewReviews={(prod) => handleViewProductReviews(prod.id)}
                  onAddNew={handleAddNew}
                  isLoading={status === "loading"}
                />
              )}

              {visibleTab === "Product Library" && visibleViewMode === "details" && selectedProduct && (
                <ProductDetailsView
                  product={selectedProduct}
                  onBack={() => setViewMode("list")}
                  onEditProduct={handleEditProduct}
                  onEditAliases={handleEditProduct}
                  onDelete={handleDeleteProduct}
                  onViewAllCampaigns={handleViewAllProductCampaigns}
                  onViewReviews={handleViewProductReviews}
                />
              )}

              {visibleTab === "Product Library" && visibleViewMode === "add" && (
                <AddProductView
                  onCancel={() => setViewMode("list")}
                  onSave={handleSaveProduct}
                  workspaceBrandName={workspaceBrandName}
                />
              )}

              {visibleTab === "Product Library" && visibleViewMode === "edit" && selectedProduct && (
                <AddProductView
                  mode="edit"
                  initialProduct={selectedProduct}
                  onCancel={() => setViewMode("details")}
                  onSave={handleUpdateProduct}
                  onDelete={() => handleDeleteProduct(selectedProduct.id)}
                  workspaceBrandName={workspaceBrandName}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
