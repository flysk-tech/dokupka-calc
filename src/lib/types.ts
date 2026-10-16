export type Product = 'widgets' | 'amo'
export type Mode = 'users' | 'term' | 'both'

export interface Period {
  months: number
  paid: number
  amo?: number
  int?: number
  label?: string
}

export interface WidgetTariff {
  pricePerUserMonth: number
  minUsers: number
  periods: Period[]
}

export interface Plan {
  g: string
  name: string
  price: number | null
  base: number
  included: number
  minUsers: number
  maxUsers: number
  from: string
  to: string
  yearly?: boolean
  note?: string
}

/* Тариф, приведённый к общему виду для расчёта */
export interface Tariff {
  name: string
  pricePerUserMonth: number
  base: number
  included: number
  minUsers: number
  maxUsers: number
  periods: Period[]
  plan?: Plan
}

export interface OptionChoice { name: string, price: number }
export interface Option {
  id: string
  name: string
  short?: string
  kind: 'choice' | 'check' | 'qty'
  price?: number
  choices?: OptionChoice[]
}
export interface SelectedOption { name: string, price: number }

export interface CalcInput {
  product: Product
  tariff: Tariff
  mode: Mode
  periodIdx: number
  extIdx: number
  start: string
  today: string
  users: number
  add: number
  options: SelectedOption[]
}

export interface CalcResult {
  title: string
  sum: string
  error?: string
  rows: [string, string][]
  text: string
}
