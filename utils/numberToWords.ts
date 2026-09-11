/**
 * Convierte un valor numérico a su representación en letras en idioma español,
 * con formato estándar bancario / comercial (ej. "DOSCIENTOS CUARENTA Y DOS PESOS 00/100 M.N.").
 */

function convertHundreds(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const twenties = ['VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const tens = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  let result = '';
  const c = Math.floor(n / 100);
  const rem = n % 100;

  if (c > 0) {
    result += hundreds[c] + ' ';
  }

  if (rem === 0) {
    return result.trim();
  }

  if (rem < 10) {
    result += units[rem];
  } else if (rem >= 10 && rem < 20) {
    result += teens[rem - 10];
  } else if (rem >= 20 && rem < 30) {
    result += twenties[rem - 20];
  } else {
    const t = Math.floor(rem / 10);
    const u = rem % 10;
    result += tens[t];
    if (u > 0) {
      result += ' Y ' + units[u];
    }
  }

  return result.trim();
}

export function numberToWordsSpanish(
  amount: number,
  currencyName: string = 'PESOS',
  currencySuffix: string = 'M.N.'
): string {
  const safeAmount = Math.max(0, amount);
  const integerPart = Math.floor(safeAmount);
  const cents = Math.round((safeAmount - integerPart) * 100);
  const centsStr = cents.toString().padStart(2, '0') + '/100';

  // Ajustar singular/plural si es PESOS
  let currency = currencyName.toUpperCase().trim();
  if (currency === 'PESOS' && integerPart === 1) {
    currency = 'PESO';
  } else if (currency === 'DÓLARES' && integerPart === 1) {
    currency = 'DÓLAR';
  } else if (currency === 'EUROS' && integerPart === 1) {
    currency = 'EURO';
  }

  if (integerPart === 0) {
    return `CERO ${currency} ${centsStr} ${currencySuffix}`.trim();
  }

  let words = '';

  const millions = Math.floor(integerPart / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  if (millions > 0) {
    if (millions === 1) {
      words += 'UN MILLON ';
    } else {
      words += convertHundreds(millions) + ' MILLONES ';
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      words += 'UN MIL ';
    } else {
      words += convertHundreds(thousands) + ' MIL ';
    }
  }

  if (remainder > 0) {
    words += convertHundreds(remainder) + ' ';
  }

  words = words.trim();
  return `${words} ${currency} ${centsStr} ${currencySuffix}`.trim();
}
