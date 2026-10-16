import { describe, expect, it } from 'vitest'
import { AMO_PLANS } from '../data/tariffs'
import { amoTariff, compute, widgetTariff } from './calc'
import type { CalcInput } from './types'

const base = (o: Partial<CalcInput>): CalcInput => ({
  product: 'widgets', tariff: widgetTariff(), mode: 'users', periodIdx: 3, extIdx: 0,
  start: '2026-04-16', today: '2026-10-16', users: 12, add: 3, options: [], ...o
})
const amo = (o: Partial<CalcInput> = {}) => base({ product: 'amo', tariff: amoTariff(AMO_PLANS[0]), periodIdx: 3, extIdx: 1, ...o })
const sum = (r: { sum: string }) => r.sum.replace(/\D/g, '')

describe('compute', () => {
  it('виджеты: докупка без бонусов', () => {
    expect(sum(compute(base({})))).toBe('1782')
  })
  it('виджеты: продление', () => {
    expect(sum(compute(base({ mode: 'term' })))).toBe('1188')
  })
  it('виджеты: докупка + продление', () => {
    expect(sum(compute(base({ mode: 'both' })))).toBe('3267')
  })
  it('amoCRM: докупка + продление с опциями', () => {
    const options = [{ name: 'API', price: 60000 }, { name: 'Лимиты+', price: 999 }, { name: 'Файлы', price: 1998 }]
    const r = compute(amo({ mode: 'both', options }))
    expect(sum(r)).toBe('588435')
    expect(r.text).toContain('без НДС')
  })
  it('ошибки: тариф закончился и лимит пользователей', () => {
    expect(compute(base({ today: '2028-01-01' })).error).toMatch(/закончился/)
    expect(compute(amo({ tariff: amoTariff(AMO_PLANS.find(p => p.name === 'Микро-бизнес')!), users: 2, add: 1 })).error).toMatch(/Лимит/)
  })
})
