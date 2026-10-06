export const CATEGORIES = [
  "Food",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Bills",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;
  /** ISO date string, YYYY-MM-DD */
  date: string;
  amount: number;
  category: Category;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseInput = Pick<Expense, "date" | "amount" | "category" | "description">;

export interface ExpenseFilters {
  search: string;
  category: Category | "All";
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: ExpenseFilters = {
  search: "",
  category: "All",
  startDate: "",
  endDate: "",
};

export const CATEGORY_STYLES: Record<Category, { color: string; badge: string; icon: string }> = {
  Food: { color: "#2a78d6", badge: "bg-blue-50 text-blue-700 ring-blue-600/20", icon: "🍔" },
  Transportation: { color: "#eb6834", badge: "bg-orange-50 text-orange-700 ring-orange-600/20", icon: "🚗" },
  Entertainment: { color: "#1baf7a", badge: "bg-teal-50 text-teal-700 ring-teal-600/20", icon: "🎬" },
  Shopping: { color: "#eda100", badge: "bg-amber-50 text-amber-800 ring-amber-600/20", icon: "🛍️" },
  Bills: { color: "#e87ba4", badge: "bg-pink-50 text-pink-700 ring-pink-600/20", icon: "🧾" },
  Other: { color: "#008300", badge: "bg-green-50 text-green-800 ring-green-600/20", icon: "📦" },
};
