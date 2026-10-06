export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  message: string;
  iconSrc: string;
  bgClass: string;
  iconColor: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  imageSrc: string;
  category: string;
  flavor: string;
  format: string;
  size: string;
  sku?: string;
  aliases: string[];
  aliasCount?: number;
  aliasRecords?: { id: string; alias_text: string }[];
  activeCampaigns: number;
}

export const initialNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Low Wallet Balance",
    time: "2m ago",
    message: "Your wallet balance is below $500. Add funds to keep campaigns active.",
    iconSrc: "/Notification/LowWalletBalance.svg",
    bgClass: "bg-[rgba(186,26,26,0.1)]",
    iconColor: "#BA1A1A",
  },
  {
    id: "2",
    title: "Pending Approvals",
    time: "45m ago",
    message: "3 new campaign requests are waiting for your executive review.",
    iconSrc: "/Notification/pendingApproval.svg",
    bgClass: "bg-[rgba(0,27,210,0.1)]",
    iconColor: "#001BD2",
  },
  {
    id: "3",
    title: "Campaign Budget Ending",
    time: "3h ago",
    message: "'Summer Velocity' campaign is at 95% of its total budget limit.",
    iconSrc: "/Notification/campainsAndBudgetEding.svg",
    bgClass: "bg-[rgba(186,26,26,0.1)]",
    iconColor: "#BA1A1A",
  },
  {
    id: "4",
    title: "Reward Issued",
    time: "5h ago",
    message: "Cashback rewards for 1,240 users have been successfully processed.",
    iconSrc: "/Notification/REviewIssue.svg",
    bgClass: "bg-[rgba(76,215,246,0.2)]",
    iconColor: "#004956",
  },
  {
    id: "5",
    title: "Product Alias Added",
    time: "1d ago",
    message: "System: 'Premium Tier-B' alias mapping was added to the campaign catalog.",
    iconSrc: "/Notification/ProductAlliceAlert.svg",
    bgClass: "bg-[#D0E1FB]",
    iconColor: "#505F76",
  },
];

export const initialProducts: Product[] = [
  {
    id: "1",
    name: "Kettle Sea Salt Chips",
    imageSrc: "/Auth/rebateImage.svg",
    category: "SNACKS",
    flavor: "SEA SALT",
    format: "5OZ BAG",
    size: "5oz",
    aliases: ["Kettle Chips", "Kettle Sea Salt", "Kettle 5oz", "KET SS 5Z"],
    activeCampaigns: 3,
  },
  {
    id: "2",
    name: "Nitro Cold Brew",
    imageSrc: "/nitro_cold_brew.jpg",
    category: "BEVERAGE",
    flavor: "VANILLA",
    format: "12OZ CAN",
    size: "12oz",
    aliases: ["Nitro Cold Brew", "Cold Brew Vanilla", "Nitro Can"],
    activeCampaigns: 1,
  },
  {
    id: "3",
    name: "Wild Berry Trail Mix",
    imageSrc: "/trail_mix.jpg",
    category: "PANTRY",
    flavor: "ORGANIC",
    format: "8OZ POUCH",
    size: "8oz",
    aliases: ["Trail Mix", "Wild Berry Mix", "Berry Pouch"],
    activeCampaigns: 5,
  },
  {
    id: "4",
    name: "Zesty Lime Sparkler",
    imageSrc: "/lime_sparkler.jpg",
    category: "BEVERAGE",
    flavor: "LIME",
    format: "12PK CASE",
    size: "12pk",
    aliases: ["Zesty Lime", "Lime Sparkler", "Sparkler 12pk"],
    activeCampaigns: 0,
  },
  {
    id: "5",
    name: "Dark Cacao Bar",
    imageSrc: "/Auth/reviewImage.svg",
    category: "CONFECTIONERY",
    flavor: "72% DARK",
    format: "SINGLE BAR",
    size: "single",
    aliases: ["Dark Cacao", "Cacao 72%", "Cacao Bar"],
    activeCampaigns: 2,
  },
];
