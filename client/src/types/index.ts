export interface Expense {
  id: string;
  date: string;
  item: string;
  cost: number;
  category: string;
}

export interface AuthStatus {
  authenticated: boolean;
  hasSpreadsheet: boolean;
}
