import { CartItem, Promotion } from '../types';

/**
 * Checks if a promotion is valid for the current day and time.
 */
export function isPromotionActiveNow(promo: Promotion, currentDate: Date = new Date()): boolean {
  if (!promo.isActive) return false;

  // Day of week check: 0 is Sunday, 1 is Monday ... 6 is Saturday
  if (promo.daysOfWeek && promo.daysOfWeek.length > 0) {
    const currentDay = currentDate.getDay();
    if (!promo.daysOfWeek.includes(currentDay)) {
      return false;
    }
  }

  // Time of day check (format: "HH:MM")
  if (promo.startTime && promo.endTime) {
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    const currentMinutesOfDay = currentHours * 60 + currentMinutes;

    const [startH, startM] = promo.startTime.split(':').map(Number);
    const [endH, endM] = promo.endTime.split(':').map(Number);

    const startMinutesOfDay = (startH || 0) * 60 + (startM || 0);
    const endMinutesOfDay = (endH || 0) * 60 + (endM || 0);

    if (startMinutesOfDay <= endMinutesOfDay) {
      if (currentMinutesOfDay < startMinutesOfDay || currentMinutesOfDay > endMinutesOfDay) {
        return false;
      }
    } else {
      // Crosses midnight (e.g. 22:00 to 02:00)
      if (currentMinutesOfDay < startMinutesOfDay && currentMinutesOfDay > endMinutesOfDay) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculates the discount amount that a promotion provides for a given cart.
 */
export function calculateOrderPromotionDiscount(
  cart: CartItem[], 
  promo: Promotion
): { discountAmount: number; description: string; eligible: boolean; message?: string } {
  if (!cart || cart.length === 0) {
    return { discountAmount: 0, description: promo.name, eligible: false, message: 'El carrito está vacío' };
  }

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (promo.minOrderAmount !== undefined && promo.minOrderAmount > 0 && cartTotal < promo.minOrderAmount) {
    return {
      discountAmount: 0,
      description: promo.name,
      eligible: false,
      message: `Requiere un consumo mínimo de $${promo.minOrderAmount.toLocaleString()}`
    };
  }

  // Filter items eligible for this promotion
  const eligibleItems = cart.filter(item => {
    // If specific products are selected, item must match
    if (promo.applicableProductIds && promo.applicableProductIds.length > 0) {
      if (!promo.applicableProductIds.includes(item.id)) return false;
    }
    // If specific categories are selected, item category must match
    if (promo.applicableCategories && promo.applicableCategories.length > 0) {
      if (!promo.applicableCategories.includes(item.category)) return false;
    }
    return true;
  });

  if (eligibleItems.length === 0) {
    return {
      discountAmount: 0,
      description: promo.name,
      eligible: false,
      message: 'No hay productos participantes en esta promoción en el carrito'
    };
  }

  let discount = 0;

  switch (promo.type) {
    case 'two_for_one': {
      // Flatten individual units sorted by price ascending (cheaper one is free)
      const unitPrices: number[] = [];
      eligibleItems.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          unitPrices.push(item.price);
        }
      });
      unitPrices.sort((a, b) => a - b);

      // In 2x1, for every 2 items, the cheaper one is discounted
      const pairs = Math.floor(unitPrices.length / 2);
      for (let i = 0; i < pairs; i++) {
        discount += unitPrices[i];
      }
      break;
    }

    case 'three_for_two': {
      const unitPrices: number[] = [];
      eligibleItems.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          unitPrices.push(item.price);
        }
      });
      unitPrices.sort((a, b) => a - b);

      // In 3x2, for every 3 items, 1 is free
      const triplets = Math.floor(unitPrices.length / 3);
      for (let i = 0; i < triplets; i++) {
        discount += unitPrices[i];
      }
      break;
    }

    case 'percentage': {
      const eligibleSubtotal = eligibleItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const pct = Math.max(0, Math.min(100, promo.discountValue));
      discount = (eligibleSubtotal * pct) / 100;
      break;
    }

    case 'fixed_amount': {
      discount = Math.min(cartTotal, promo.discountValue);
      break;
    }

    case 'special_price': {
      // Discount value is the target special price per item
      eligibleItems.forEach(item => {
        if (item.price > promo.discountValue) {
          discount += (item.price - promo.discountValue) * item.quantity;
        }
      });
      break;
    }
  }

  discount = Math.round(discount * 100) / 100;

  return {
    discountAmount: discount,
    description: promo.name,
    eligible: discount > 0,
    message: discount > 0 ? `Descuento aplicado: -$${discount.toLocaleString()}` : 'No alcanza el mínimo de artículos para la promoción'
  };
}

export interface ProductPromoInfo {
  promo: Promotion;
  badge: string;
  promoPrice: number | null;
  discountLabel: string;
}

/**
 * Returns promo details for a product if it participates in an active promotion.
 */
export function getProductActivePromo(
  product: { id: string; price: number; category: string },
  activePromos: Promotion[]
): ProductPromoInfo | null {
  if (!activePromos || activePromos.length === 0) return null;

  for (const promo of activePromos) {
    const matchesProduct = !promo.applicableProductIds || promo.applicableProductIds.length === 0 || promo.applicableProductIds.includes(product.id);
    const matchesCategory = !promo.applicableCategories || promo.applicableCategories.length === 0 || promo.applicableCategories.includes(product.category);
    
    if (matchesProduct && matchesCategory) {
      if (promo.type === 'special_price') {
        return {
          promo,
          badge: `★ $${promo.discountValue.toLocaleString()}`,
          promoPrice: promo.discountValue,
          discountLabel: `$${promo.discountValue}`
        };
      } else if (promo.type === 'percentage') {
        const promoPrice = Math.round(product.price * (1 - promo.discountValue / 100));
        return {
          promo,
          badge: `${promo.discountValue}% OFF`,
          promoPrice,
          discountLabel: `${promo.discountValue}% OFF`
        };
      } else if (promo.type === 'two_for_one') {
        return {
          promo,
          badge: '2x1',
          promoPrice: null,
          discountLabel: '2x1'
        };
      } else if (promo.type === 'three_for_two') {
        return {
          promo,
          badge: '3x2',
          promoPrice: null,
          discountLabel: '3x2'
        };
      } else if (promo.type === 'fixed_amount') {
        return {
          promo,
          badge: `-$${promo.discountValue}`,
          promoPrice: Math.max(0, product.price - promo.discountValue),
          discountLabel: `-$${promo.discountValue}`
        };
      }
    }
  }
  return null;
}
