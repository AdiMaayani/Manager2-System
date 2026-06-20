export function formatCurrency(value: number): string {
  return value.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return datePart;
  return `${day}/${month}/${year}`;
}
