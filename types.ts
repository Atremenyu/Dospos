
export type Category = string;

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  unit: 'g' | 'ml' | 'unit';
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
}

export interface Modifier {
  id: string;
  name: string;
  extraPrice: number;
  recipe?: RecipeItem[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  modifierGroups?: ModifierGroup[];
  hasCombo?: boolean;
  comboOptions?: ComboOption[];
  recipe?: RecipeItem[];
}

export interface ComboOption {
  id: string;
  label: string;
  extraPrice: number;
}

export interface SelectedModifier {
  modifierId: string;
  modifierName: string;
  extraPrice: number;
}

export interface CartItem extends Product {
  quantity: number;
  paidQuantity?: number;
  note?: string;
  status?: OrderStatus;
  selectedModifiers?: SelectedModifier[];
  isCombo?: boolean;
  selectedComboOptions?: ComboOption[];
}

export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Pendiente' | 'Uber' | 'Didi' | 'Cortesía';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderType = 'dine-in' | 'takeaway';
export type TakeawayType = 'local' | 'delivery' | 'uber' | 'didi';

export interface PartialPayment {
  method: PaymentMethod;
  amount: number;
  date: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  tip: number;
  timestamp: string;
}

export interface Order {
  id: string;
  date: string;
  client: string;
  address?: string;
  table: string;
  payment: PaymentMethod;
  status: OrderStatus;
  type: OrderType;
  takeawayType?: TakeawayType;
  total: number;
  tip: number;
  items: CartItem[];
  isPaid: boolean;
  payments: PaymentRecord[];
  estimatedMinutes?: number;
  preparingAt?: string;
  readyAt?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
}

export interface CashShift {
  id: string;
  userId: string;
  userName: string;
  openingTime: string;
  closingTime?: string;
  initialFund: number;
  expectedAmount?: number;
  actualAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
  expectedCash?: number;
  actualCash?: number;
  differenceCash?: number;
  expectedTarjeta?: number;
  actualTarjeta?: number;
  differenceTarjeta?: number;
  expectedTransferencia?: number;
  actualTransferencia?: number;
  differenceTransferencia?: number;
  expectedOtros?: number;
}

export interface StoreSettings {
  name: string;
  eventType: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency: string;
  taxRate: number;
  receiptHeader?: string;
  receiptFooter?: string;
}

export type ViewState = 'pos' | 'dispatch' | 'central' | 'tables' | 'login' | 'cash_audit';
export type AdminTabType = 'overview' | 'history' | 'cash' | 'products' | 'categories' | 'inventory' | 'tables' | 'users' | 'roles' | 'shifts' | 'general';

export interface UserRole {
  name: string;
  permissions: ViewState[];
  allowCourtesy?: boolean;
}

export interface User {
  id: string;
  name: string;
  pin: string;
  role: string;
}

export interface Table {
  id: string;
  name: string;
  status: 'free' | 'occupied' | 'reserved';
  currentOrderId?: string;
}
