
export type Category = string;

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  unit: 'g' | 'ml' | 'unit';
  cost?: number;
  updatedAt?: string;
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
  cost?: number;
  stock?: number;
  category: Category;
  modifierGroups?: ModifierGroup[];
  hasCombo?: boolean;
  comboOptions?: ComboOption[];
  recipe?: RecipeItem[];
  updatedAt?: string;
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
  receivedAmount?: number;
  change?: number;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber?: number | string;
  movementNumber?: number | string;
  date: string;
  client: string;
  address?: string;
  table: string;
  diners?: number;
  waiter?: string;
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
  preticketPrintedAt?: string;
  closedAt?: string;
  receivedAmount?: number;
  changeAmount?: number;
  discountAmount?: number;
  discountReason?: string;
  appliedPromotionId?: string;
  subtotalBeforeDiscount?: number;
  updatedAt?: string;
}

export type PromotionType = 'two_for_one' | 'three_for_two' | 'percentage' | 'fixed_amount' | 'special_price';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: PromotionType;
  discountValue: number; // e.g. 15 for 15% or 50 for $50
  applicableProductIds?: string[];
  applicableCategories?: string[];
  minOrderAmount?: number;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday... 6=Saturday. Empty = every day
  startTime?: string; // "HH:MM" e.g. "18:00"
  endTime?: string; // "HH:MM" e.g. "21:00"
  isActive: boolean;
  updatedAt?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  updatedAt?: string;
}

export interface CategoryProductSale {
  name: string;
  quantity: number;
  total: number;
}

export interface CategorySalesSummary {
  category: string;
  totalSales: number;
  totalQuantity: number;
  percentage: number;
  products: CategoryProductSale[];
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
  expectedCourtesy?: number;
  categoryBreakdown?: CategorySalesSummary[];
  totalArticlesSold?: number;
  updatedAt?: string;
}

export interface StoreSettings {
  name: string;
  eventType: string;
  address?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency: string;
  currencyText?: string;
  taxRate: number;
  includeTaxBreakdown?: boolean;
  terminalName?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  defaultDiners?: number;

  // Interruptores / Switches de visibilidad en tickets
  showTicketAddress?: boolean;
  showTicketPhone?: boolean;
  showTicketTaxId?: boolean;
  showTicketHeaderMsg?: boolean;
  showTicketDate?: boolean;
  showTicketOrderNum?: boolean;
  showTicketTable?: boolean;
  showTicketWaiter?: boolean;
  showTicketTimes?: boolean;
  showTicketDeliveryAddress?: boolean;
  showTicketTotalArticles?: boolean;
  showTicketSubtotal?: boolean;
  showTicketTax?: boolean;
  showTicketAmountInWords?: boolean;
  showTicketPaymentDetails?: boolean;
  showTicketTerminal?: boolean;
  showTicketFooterMsg?: boolean;
}

export type ViewState = 'pos' | 'dispatch' | 'central' | 'tables' | 'staff' | 'login' | 'cash_audit';
export type AdminTabType = 'overview' | 'analytics' | 'history' | 'cash' | 'staff_consumptions' | 'products' | 'promotions' | 'categories' | 'inventory' | 'tables' | 'users' | 'roles' | 'shifts' | 'general';

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

export type ConsumptionReason = 
  | 'Turno de trabajo'
  | 'Cortesía administrativa'
  | 'Evento especial'
  | 'Merma de barra'
  | 'Degustación'
  | 'Cierre masivo de barra';

export interface StaffConsumptionItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number; // Retail commercial value
  unitCost: number;  // Real accounting cost
  totalRetailValue: number; // quantity * unitPrice
  totalCostValue: number;   // quantity * unitCost
}

export interface StaffConsumption {
  id: string;
  date: string;
  cashShiftId?: string;
  beneficiaryName: string;
  beneficiaryUserId?: string;
  authorizedBy: string;
  reason: ConsumptionReason;
  notes?: string;
  mode: 'individual' | 'bulk_closing';
  items: StaffConsumptionItem[];
  totalRetailValue: number;
  totalCostValue: number;
  totalItemsCount: number;
  updatedAt?: string;
}
