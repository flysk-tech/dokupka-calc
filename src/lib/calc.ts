import { AMO_BONUS, AMO_PAID, INTEGRATOR_BONUS, WIDGETS } from '../data/tariffs'
import type { CalcInput, CalcResult, Period, Plan, Tariff } from './types'

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽'
const ruNum = (x: number) => x.toFixed(2).replace('.', ',')

function monthWord(n: number) {
  const a = n % 100, b = n % 10
  if (a > 10 && a < 20) return 'месяцев'
  if (b === 1) return 'месяц'
  if (b >= 2 && b <= 4) return 'месяца'
  return 'месяцев'
}

export function periodLabel(p: Period) {
  if (p.label) return p.label
  const g = p.months - p.paid
  let s = p.months === 12 ? '1 год' : p.months === 24 ? '2 года' : p.months + ' ' + monthWord(p.months)
  if (g > 0) s += ' (+' + g + ' в подарок)'
  return s
}

export function amoPeriods(plan: Plan): Period[] {
  if (plan.yearly) return [{ months: 12, paid: 12, label: '1 год' }]
  return AMO_PAID.map(paid => {
    const amo = AMO_BONUS[paid] || 0, int = INTEGRATOR_BONUS
    const parts: string[] = []
    if (amo) parts.push('+' + amo + ' amoCRM')
    if (int) parts.push('+' + int + ' от нас')
    return {
      months: paid + amo + int, paid, amo, int,
      label: paid + ' мес. оплаты → ' + (paid + amo + int) + ' мес.' + (parts.length ? ' (' + parts.join(', ') + ')' : '')
    }
  })
}

export function widgetTariff(): Tariff {
  return { name: 'Виджеты Флайск', pricePerUserMonth: WIDGETS.pricePerUserMonth, base: 0, included: 0, minUsers: WIDGETS.minUsers, maxUsers: Infinity, periods: WIDGETS.periods }
}

export function amoTariff(plan: Plan): Tariff {
  return { name: plan.name, pricePerUserMonth: plan.price ?? 0, base: plan.base, included: plan.included, minUsers: plan.minUsers, maxUsers: plan.maxUsers, periods: amoPeriods(plan), plan }
}

/* стоимость подписки в месяц для users пользователей */
export const monthly = (t: Tariff, users: number) => t.base + t.pricePerUserMonth * Math.max(0, users - t.included)

export function addMonths(d: Date, m: number) {
  const r = new Date(d.getFullYear(), d.getMonth() + m, d.getDate())
  // 31 января + 1 мес. → последний день февраля
  if (r.getDate() !== d.getDate()) r.setDate(0)
  return r
}

/* Остаток периода в месяцах: полные календарные месяцы + дни/30 */
export function remainingMonths(from: Date, to: Date) {
  if (to <= from) return { months: 0, full: 0, days: 0 }
  let full = 0
  while (addMonths(from, full + 1) <= to) full++
  const days = Math.round((to.getTime() - addMonths(from, full).getTime()) / 86400000)
  return { months: full + days / 30, full, days }
}

export const parseD = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }
export const dfmt = (d: Date) => d.toLocaleDateString('ru-RU')

const empty = (title: string, error = ''): CalcResult => ({ title, sum: '', error, rows: [], text: '' })

export function compute(i: CalcInput): CalcResult {
  const { tariff: t, product, mode } = i
  const amo = product === 'amo'
  const p = t.periods[i.periodIdx] || t.periods[0]
  const users = i.users
  const title0 = 'Доплатить'
  if (!i.start || !i.today) return empty(title0)
  if (!(users >= t.minUsers)) return empty(title0, 'Минимум ' + t.minUsers + ' пользователей')
  if (users > t.maxUsers) return empty(title0, 'В тарифе максимум ' + t.maxUsers + ' пользователей')

  const start = parseD(i.start), today = parseD(i.today)
  const end = addMonths(start, p.months)
  const optM = i.options.reduce((s, o) => s + o.price, 0)
  const optNames = i.options.map(o => o.name).join('; ')
  const perMonth = monthly(t, users)
  const simple = t.base === 0 && t.included === 0
  const vat = amo ? ', без НДС' : ''
  const prod = amo ? 'Лицензия amoCRM «' + t.name + '»' : 'Виджеты Флайск'
  const clientPeriod = (q: Period) => {
    const gift = q.months - q.paid
    if (amo) return gift > 0 ? `${q.months} мес. (оплата ${q.paid} мес. + ${gift} в подарок)` : `${q.months} мес.`
    return periodLabel(q)
  }
  const optLine = i.options.length ? `\nПодключённые опции: ${optNames} — ${fmt(optM)} в мес.` : ''
  const close = '\n\nЕсли всё верно, выставим счёт.'

  const rows: [string, string][] = []
  if (amo) rows.push(['Тариф', t.name])
  rows.push(['Куплено', `${periodLabel(p)}, ${users} польз.`])
  if (i.options.length) rows.push(['Опции', `${optNames} — ${fmt(optM)} в мес.`])
  rows.push(['Оплачено', fmt((perMonth + optM) * p.paid)])
  rows.push(['Тариф действует', `${dfmt(start)} — ${dfmt(end)}`])

  if (today < start) return empty(title0, 'Дата докупки раньше даты начала')
  if (today >= end) return empty(title0, 'Тариф уже закончился — нужна новая покупка')

  const rem = remainingMonths(today, end)
  rows.push(['Осталось до конца', `${rem.full} мес. ${rem.days} дн. (≈ ${rem.months.toFixed(2)} мес.)`])

  const addN = mode === 'term' ? 0 : i.add
  if (mode !== 'term') {
    if (!(addN >= 1)) return empty(title0)
    if (users + addN > t.maxUsers) return empty(title0, 'Лимит тарифа — ' + t.maxUsers + ' польз., докупить нельзя')
  }
  const total = users + addN
  const usersLine = `Сейчас: ${users} польз., подписка оплачена до ${dfmt(end)}.`

  // докупка пользователей — без бонусов: полная цена × остаток месяцев; опции от числа пользователей не зависят
  let topUp = 0, topFormulaRow = '', topFormula = ''
  if (addN) {
    const delta = monthly(t, total) - perMonth
    topUp = Math.ceil(delta * rem.months)
    topFormulaRow = simple ? `${t.pricePerUserMonth} ₽ × ${addN} польз. × ${rem.months.toFixed(2)} мес.` : `${fmt(delta)} в мес. × ${rem.months.toFixed(2)} мес.`
    topFormula = simple ? `${t.pricePerUserMonth} ₽ × ${addN} польз. × ${ruNum(rem.months)} мес.` : `${fmt(delta)} в мес. × ${ruNum(rem.months)} мес.`
  }
  const noBonus = `(бонусные месяцы при докупке пользователей не начисляются)`

  // продление — на всех пользователей, бонусные месяцы действуют
  let extSum = 0, ext = p, newEnd = end, extFormulaRow = ''
  if (mode !== 'users') {
    ext = t.periods[i.extIdx] || t.periods[0]
    extSum = (monthly(t, total) + optM) * ext.paid
    newEnd = addMonths(end, ext.months)
    extFormulaRow = `${fmt(monthly(t, total) + optM)} в мес. × ${ext.paid} опл. мес.`
  }

  if (mode === 'users') {
    rows.push(['Формула', topFormulaRow])
    rows.push(['Пользователей после докупки', String(total)])
    return {
      title: `Доплатить за ${addN} польз. до конца срока`, sum: fmt(topUp), rows,
      text: `Здравствуйте!\n\nРассчитали докупку пользователей.\n\n${prod}.\n${usersLine}\nДобавляем: ${addN} польз. (станет ${total}).\nДо конца оплаченного периода осталось ${rem.full} мес. ${rem.days} дн.\n\nСтоимость докупки: ${fmt(topUp)}${vat}\nРасчёт: ${topFormula} ${noBonus}.${close}`
    }
  }
  if (mode === 'term') {
    rows.push(['Продление', `${periodLabel(ext)} для ${users} польз.`])
    rows.push(['Новая дата окончания', dfmt(newEnd)])
    rows.push(['Формула', extFormulaRow])
    return {
      title: 'К оплате за продление', sum: fmt(extSum), rows,
      text: `Здравствуйте!\n\nРассчитали продление.\n\n${prod}, ${users} польз.\nПодписка оплачена до ${dfmt(end)}.\nПродлеваем на ${clientPeriod(ext)}. После продления подписка будет действовать до ${dfmt(newEnd)}.${optLine}\n\nК оплате: ${fmt(extSum)}${vat}${close}`
    }
  }
  rows.push(['1. Докупка', `${fmt(topUp)} (${topFormulaRow})`])
  rows.push(['2. Продление', `${fmt(extSum)} (${extFormulaRow})`])
  rows.push(['Продление', `${periodLabel(ext)} для ${total} польз.`])
  rows.push(['Новая дата окончания', dfmt(newEnd)])
  return {
    title: 'Итого к оплате: докупка + продление', sum: fmt(topUp + extSum), rows,
    text: `Здравствуйте!\n\nРассчитали докупку пользователей вместе с продлением.\n\n${prod}.\n${usersLine}\n\n1) Докупка ${addN} польз. до ${dfmt(end)} (осталось ${rem.full} мес. ${rem.days} дн.): ${fmt(topUp)}\nРасчёт: ${topFormula} ${noBonus}.\n\n2) Продление на ${clientPeriod(ext)} для ${total} польз.: ${fmt(extSum)}\nПосле продления подписка будет действовать до ${dfmt(newEnd)}.${optLine}\n\nИтого к оплате: ${fmt(topUp + extSum)}${vat}${close}`
  }
}
