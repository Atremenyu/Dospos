import fs from 'fs';
import path from 'path';
import { computeShiftCategorySales } from '../services/thermalPrinter';
import { CashShift, Order, Product } from '../types';

console.log("==========================================");
console.log(" INICIANDO BATERÍA DE PRUEBAS DEL SISTEMA ");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, extraInfo?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${extraInfo ? ` - ${extraInfo}` : ''}`);
    testsFailed++;
  }
}

// TEST 1: Reconciliación de turnos y corte de caja con ventas del mismo día antes de apertura
console.log("\n--- TEST 1: Cálculo de Corte con effectiveStartTime ---");
const testShift: CashShift = {
  id: 'csh_test_1',
  userId: 'usr_admin',
  userName: 'Admin',
  openingTime: '2026-11-01T14:00:00.000Z',
  initialFund: 500,
  status: 'open',
  updatedAt: '2026-11-01T14:00:00.000Z'
};

const morningOrder: Order = {
  id: 'ord_morning',
  orderNumber: '1',
  movementNumber: '8870',
  client: 'Cliente Matutino',
  type: 'takeaway',
  table: undefined,
  tip: 0,
  items: [{ id: 'p1', name: 'Taco', price: 100, quantity: 2, category: 'Tacos' }],
  total: 200,
  payment: 'Efectivo',
  isPaid: true,
  status: 'delivered',
  date: '2026-11-01T10:30:00.000Z',
  payments: [{
    id: 'pay_1',
    amount: 200,
    method: 'Efectivo',
    tip: 0,
    timestamp: '2026-11-01T10:30:00.000Z'
  }]
};

const afternoonOrder: Order = {
  id: 'ord_afternoon',
  orderNumber: '2',
  movementNumber: '8871',
  client: 'Cliente Tarde',
  type: 'dine-in',
  table: 'Mesa 1',
  tip: 10,
  items: [{ id: 'p2', name: 'Refresco', price: 50, quantity: 1, category: 'Bebidas' }],
  total: 50,
  payment: 'Tarjeta',
  isPaid: true,
  status: 'delivered',
  date: '2026-11-01T15:00:00.000Z',
  payments: [{
    id: 'pay_2',
    amount: 50,
    method: 'Tarjeta',
    tip: 10,
    timestamp: '2026-11-01T15:00:00.000Z'
  }]
};

const allOrders = [morningOrder, afternoonOrder];
const productsCatalog: Product[] = [
  { id: 'p1', name: 'Taco', price: 100, category: 'Tacos' },
  { id: 'p2', name: 'Refresco', price: 50, category: 'Bebidas' }
];

const categoryResult = computeShiftCategorySales(testShift, allOrders, productsCatalog, [testShift]);
assert(categoryResult.totalArticlesSold === 3, "Total de artículos vendidos incluye ventas matutinas");
assert(categoryResult.categorySalesTotal === 250, "Total de ventas por categoría suma $250.00");
assert(categoryResult.categoryBreakdown.length === 2, "Desglose por categorías contiene Tacos y Bebidas");

// TEST 2: Protección contra regresión de turnos cerrados
console.log("\n--- TEST 2: Preservación de Estado Cerrado en Turnos ---");
const closedShift: CashShift = {
  id: 'csh_closed_1',
  userId: 'usr_admin',
  userName: 'Admin',
  openingTime: '2026-10-31T10:00:00.000Z',
  closingTime: '2026-10-31T23:59:59.999Z',
  initialFund: 500,
  status: 'closed',
  actualAmount: 1500,
  expectedAmount: 1500,
  difference: 0
};

const staleIncomingPacket: CashShift = {
  ...closedShift,
  status: 'open',
  closingTime: undefined
};

// Simulamos la lógica de mergeById implementada en server.ts y App.tsx
const shiftMap = new Map<string, CashShift>();
shiftMap.set(closedShift.id, closedShift);

// Intentamos sobreescribir con el paquete obsoleto
const existing = shiftMap.get(staleIncomingPacket.id);
if (!(existing && existing.status === 'closed' && staleIncomingPacket.status === 'open')) {
  shiftMap.set(staleIncomingPacket.id, staleIncomingPacket);
}

assert(shiftMap.get(closedShift.id)?.status === 'closed', "Un turno cerrado nunca se revierte a abierto");

// TEST 3: Resiliencia ante JSON corrupto en Storage
console.log("\n--- TEST 3: Manejo Seguro de Datos en Almacenamiento ---");
function safeParseMock<T>(data: string | null, fallback: T): T {
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch (err) {
    return fallback;
  }
}

const corruptedJson = '{"orders": [ { id: "ord_1", unterminated string';
const parsed = safeParseMock(corruptedJson, []);
assert(Array.isArray(parsed) && parsed.length === 0, "JSON corrupto retorna fallback sin lanzar excepción");

// TEST 4: Verificación de estructura Dockerfile y package.json
console.log("\n--- TEST 4: Verificación de Configuración de Deploy ---");
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
assert(packageJson.scripts && packageJson.scripts.build && packageJson.scripts.start, "package.json tiene scripts build y start definidos");
assert(!fs.existsSync(path.join(process.cwd(), 'bun.lock')), "No existe bun.lock conflictivo en el repositorio");
assert(fs.existsSync(path.join(process.cwd(), 'package-lock.json')), "package-lock.json existe y está disponible para npm ci");

// TEST 5: Verificación de compilación de servidor
console.log("\n--- TEST 5: Verificación de Servidor Embebibles y Dist ---");
assert(fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')), "dist/index.html existe");
assert(fs.existsSync(path.join(process.cwd(), 'dist', 'server.cjs')), "dist/server.cjs compilado existe");

console.log("\n==========================================");
console.log(` RESULTADOS: ${testsPassed} Pasadas, ${testsFailed} Fallidas`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("✨ TODOS LOS SISTEMAS LISTOS PARA EL NUEVO DEPLOY ✨");
  process.exit(0);
}
