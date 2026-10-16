<template>
    <div class="wrap">
      <h1>Калькулятор докупки</h1>
      <Text size="l" :theme="TextSecondaryLightTheme" class="sub">
        Расчёт доплаты за пользователей или продление срока: виджеты Флайск и лицензии amoCRM
      </Text>

      <div class="tabs">
        <Button v-for="p in PRODUCTS" :key="p.id" :theme="product === p.id ? ButtonPrimaryTheme : ButtonNeutralTheme" @click="setProduct(p.id)">
          {{ p.label }}
        </Button>
      </div>

      <ContentBlock :theme="ContentBlockTheme" class="card">
        <b>{{ tariffTitle }}</b>
        <div v-if="product === 'amo'" class="grid" style="margin-top: 12px">
          <UiField label="Группа тарифов">
            <UiSelect :items="groupItems" :model-value="group" @update:model-value="setGroup(String($event))" />
          </UiField>
          <UiField label="Тариф amoCRM">
            <UiSelect :items="planItems" :model-value="planIdx" @update:model-value="setPlan(Number($event))" />
          </UiField>
        </div>
        <Text size="m" :theme="TextSecondaryLightTheme" class="note">{{ tariffNote }}</Text>
      </ContentBlock>

      <div class="tabs">
        <Button v-for="m in MODES" :key="m.id" :theme="mode === m.id ? ButtonPrimaryTheme : ButtonNeutralTheme" @click="mode = m.id">
          {{ m.label }}
        </Button>
      </div>

      <ContentBlock v-if="product === 'amo'" :theme="ContentBlockTheme" class="card">
        <b>Опции amoCRM</b>
        <Text size="m" :theme="TextSecondaryLightTheme" class="note">
          Оплачиваются за аккаунт, не зависят от числа пользователей. Подключённые опции входят в стоимость продления.
        </Text>
        <div class="grid" style="margin-top: 12px">
          <template v-for="o in AMO_OPTIONS" :key="o.id">
            <UiField v-if="o.kind === 'choice'" :label="o.name">
              <UiSelect :items="choiceItems(o)" :model-value="optChoice[o.id]" @update:model-value="optChoice[o.id] = String($event)" />
            </UiField>
            <UiField v-else-if="o.kind === 'qty'" :label="`${o.name} — ${price(o.price!)}`">
              <Input v-model="optQty[o.id]" type="number" min="0" />
            </UiField>
            <div v-else class="check">
              <UiCheck v-model="optCheck[o.id]" :label="`${o.name} — ${price(o.price!)}`" />
            </div>
          </template>
        </div>
      </ContentBlock>

      <ContentBlock :theme="ContentBlockTheme" class="card">
        <div class="grid3">
          <UiField label="Срок, на который куплен тариф">
            <UiSelect :items="periodItems" v-model="periodIdx" />
          </UiField>
          <UiField label="Дата начала (оплаты)">
            <Input v-model="start" type="date" />
          </UiField>
          <UiField label="Пользователей сейчас">
            <Input v-model="usersStr" type="number" :min="tariff.minUsers" />
          </UiField>
        </div>
        <div class="grid" style="margin-top: 14px">
          <UiField label="Сегодняшняя дата (дата докупки)">
            <Input v-model="today" type="date" />
          </UiField>
          <UiField v-if="mode !== 'term'" label="Сколько пользователей добавить">
            <Input v-model="addStr" type="number" min="1" />
          </UiField>
          <UiField v-if="mode !== 'users'" label="На какой срок продлить">
            <UiSelect :items="periodItems" v-model="extIdx" />
          </UiField>
        </div>
      </ContentBlock>

      <div class="result">
        <div class="result-title">{{ result.title }}</div>
        <div v-if="result.error" class="result-error">{{ result.error }}</div>
        <div v-else class="result-sum">{{ result.sum || '—' }}</div>
        <div class="rows">
          <div v-for="r in result.rows" :key="r[0] + r[1]"><span>{{ r[0] }}</span><b>{{ r[1] }}</b></div>
        </div>
        <div v-if="result.text" class="copy">
          <Button :theme="ButtonPrimaryTheme" @click="copy">{{ copied ? 'Скопировано' : 'Скопировать для клиента' }}</Button>
          <details>
            <summary>Показать текст сообщения</summary>
            <pre>{{ result.text }}</pre>
          </details>
        </div>
      </div>

      <ContentBlock :theme="ContentBlockTheme" class="card">
        <b>Тарифная сетка</b>
        <Text size="m" :theme="TextSecondaryLightTheme" class="note">{{ gridNote }}</Text>
        <table>
          <thead><tr><th v-for="h in grid.head" :key="h">{{ h }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in grid.rows" :key="i"><td v-for="(c, j) in r" :key="j">{{ c }}</td></tr></tbody>
        </table>
      </ContentBlock>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Button, ButtonNeutralTheme, ButtonPrimaryTheme,
  ContentBlock, ContentBlockTheme, Input, Text, TextSecondaryLightTheme
} from '@flysk-tech/amocrm-kommo-vue-ui-kit'
import UiCheck from './components/UiCheck.vue'
import UiField from './components/UiField.vue'
import UiSelect from './components/UiSelect.vue'
import { AMO_GROUPS, AMO_OPTIONS, AMO_PLANS, G_NOW, INTEGRATOR_BONUS, NOW } from './data/tariffs'
import { amoTariff, compute, fmt, monthly, periodLabel, widgetTariff } from './lib/calc'
import type { Mode, Option, Product, SelectedOption } from './lib/types'

const PRODUCTS: { id: Product, label: string }[] = [
  { id: 'widgets', label: 'Виджеты Флайск' },
  { id: 'amo', label: 'Лицензии amoCRM' }
]
const MODES: { id: Mode, label: string }[] = [
  { id: 'users', label: 'Докупить пользователей' },
  { id: 'term', label: 'Докупить срок' },
  { id: 'both', label: 'Докупка + продление' }
]

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const now = new Date()

const product = ref<Product>('widgets')
const mode = ref<Mode>('users')
const group = ref(G_NOW)
const planIdx = ref(0)
const periodIdx = ref(3)
const extIdx = ref(0)
const start = ref(ymd(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())))
const today = ref(ymd(now))
const usersStr = ref('12')
const addStr = ref('1')
const copied = ref(false)

const optChoice = reactive<Record<string, string>>({})
const optCheck = reactive<Record<string, boolean>>({})
const optQty = reactive<Record<string, string>>({})

const tariff = computed(() => product.value === 'widgets' ? widgetTariff() : amoTariff(AMO_PLANS[planIdx.value]))
const price = (n: number) => n.toLocaleString('ru-RU') + ' ₽/мес'

const groupItems = AMO_GROUPS.map(g => ({ value: g, option: g }))
const planItems = computed(() => AMO_PLANS
  .map((p, i) => ({ p, i }))
  .filter(x => x.p.g === group.value)
  .map(({ p, i }) => ({
    value: i,
    option: p.name + ' — ' + (p.yearly ? (p.base * 12).toLocaleString('ru-RU') + ' ₽/год'
      : p.base === 0 ? (p.price ?? 0).toLocaleString('ru-RU') + ' ₽/польз.' : p.base.toLocaleString('ru-RU') + ' ₽/мес')
  })))
const periodItems = computed(() => tariff.value.periods.map((p, i) => ({ value: i, option: periodLabel(p) })))
const choiceItems = (o: Option) => [
  { value: '', option: 'Не подключено' },
  ...o.choices!.map((c, i) => ({ value: String(i), option: `${c.name} — ${price(c.price)}` }))
]

function resetTariff() {
  const t = tariff.value
  periodIdx.value = t.periods.length > 3 ? 3 : 0
  extIdx.value = 0
  const u = +usersStr.value
  if (!(u >= t.minUsers)) usersStr.value = String(t.minUsers)
  else if (u > t.maxUsers) usersStr.value = String(t.maxUsers)
}
function setProduct(p: Product) { product.value = p; resetTariff() }
function setGroup(g: string) {
  group.value = g
  planIdx.value = AMO_PLANS.findIndex(p => p.g === g)
  resetTariff()
}
function setPlan(i: number) { planIdx.value = i; resetTariff() }

const selectedOptions = computed<SelectedOption[]>(() => {
  if (product.value !== 'amo') return []
  const res: SelectedOption[] = []
  for (const o of AMO_OPTIONS) {
    if (o.kind === 'choice') {
      const v = optChoice[o.id]
      if (v) { const c = o.choices![+v]; res.push({ name: o.name + ': ' + c.name.toLowerCase(), price: c.price }) }
    } else if (o.kind === 'qty') {
      const n = Math.floor(+optQty[o.id])
      if (n > 0) res.push({ name: `${o.short}, ${n * 10} ГБ`, price: o.price! * n })
    } else if (optCheck[o.id]) res.push({ name: o.short || o.name, price: o.price! })
  }
  return res
})

const result = computed(() => compute({
  product: product.value, tariff: tariff.value, mode: mode.value,
  periodIdx: periodIdx.value, extIdx: extIdx.value, start: start.value, today: today.value,
  users: +usersStr.value, add: +addStr.value, options: selectedOptions.value
}))

const tariffTitle = computed(() => product.value === 'widgets' ? 'Тариф для всех виджетов' : 'Лицензия amoCRM: ' + tariff.value.name)
const tariffNote = computed(() => {
  const t = tariff.value
  if (product.value === 'widgets') {
    return `${t.pricePerUserMonth} ₽ за пользователя в месяц, минимум ${t.minUsers} пользователей. Подарочные месяцы действуют при покупке на 7 месяцев, 1 год и 2 года.`
  }
  const pl = t.plan!
  const priceText = pl.yearly ? `${fmt(pl.base * 12)} в год`
    : pl.base > 0 && pl.included > 0 ? `${fmt(pl.base)} в месяц за ${isFinite(pl.included) ? pl.included : 'любое число'} польз.`
      : `${fmt(t.pricePerUserMonth)} за пользователя в месяц`
  return `${priceText}, без НДС. Действовал: ${pl.from} — ${pl.to}.` + (pl.note ? ' ' + pl.note : '') +
    (pl.to !== NOW ? ' Архивный тариф: расчёт по старой цене; по какой цене amoCRM продлевает такой тариф, уточняйте в кабинете клиента.' : '')
})
const gridNote = computed(() => {
  const t = tariff.value
  if (product.value === 'widgets') return ''
  if (t.plan!.yearly) return 'Годовой пакет: бонусные месяцы не предусмотрены.'
  return `Бонусы: месяцы в подарок от amoCRM + ${INTEGRATOR_BONUS} мес. от интегратора (от нас) к любому сроку. Расчёт на ${t.minUsers} польз.`
})
const grid = computed(() => {
  const t = tariff.value
  const n = t.minUsers
  if (product.value === 'widgets') {
    return {
      head: ['Срок', 'В подарок', 'За пользователя в мес.', `За ${n} польз.`],
      rows: t.periods.map(p => [
        `${p.months} мес.`, p.months - p.paid > 0 ? `${p.months - p.paid} мес.` : '—',
        `${Math.round(t.pricePerUserMonth * p.paid / p.months)} ₽`, fmt(t.pricePerUserMonth * p.paid * n)
      ])
    }
  }
  if (t.plan!.yearly) return { head: ['Срок', 'Стоимость'], rows: [['1 год', fmt(t.base * 12)]] }
  return {
    head: ['Оплата', 'Бонус amoCRM', 'Наш бонус', 'Всего мес.', 'За польз. в мес. (по факту)', `Итого за ${n} польз.`],
    rows: t.periods.map(p => [
      `${p.paid} мес.`, p.amo ? `+${p.amo} мес.` : '—', `+${p.int} мес.`, `${p.months} мес.`,
      fmt(monthly(t, n) / n * p.paid / p.months), fmt(monthly(t, n) * p.paid)
    ])
  }
})

async function copy() {
  await navigator.clipboard.writeText(result.value.text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

watch(() => product.value, () => { copied.value = false })
for (const o of AMO_OPTIONS) { optChoice[o.id] = ''; optCheck[o.id] = false; optQty[o.id] = '0' }
</script>

<style>
body { margin: 0; background: #f5f5f5; padding: 24px; font-family: var(--crm-ui-kit-font-family, "PT Sans", Arial, sans-serif); }
.wrap { max-width: 860px; margin: 0 auto; }
h1 { font-size: 26px; margin: 0 0 4px; }
.sub { display: block; margin-bottom: 20px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.card { margin-bottom: 16px; padding: 20px; }
.note { display: block; margin-top: 8px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.check { display: flex; align-items: flex-end; padding-bottom: 8px; }
@media (max-width: 640px) { .grid, .grid3 { grid-template-columns: 1fr; } }
.result { background: linear-gradient(90deg, #ead5ff, #bfdbfe); border-radius: 8px; padding: 22px; margin-bottom: 16px; }
.result-title { font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
.result-sum { font-size: 40px; font-weight: 700; margin: 4px 0 10px; }
.result-error { font-size: 18px; font-weight: 700; color: #b91c1c; margin: 8px 0 10px; }
.rows > div { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; border-top: 1px solid rgba(15, 23, 42, .1); font-size: 14px; }
.rows > div:first-child { border-top: 0; }
.rows b { text-align: right; }
.copy { margin-top: 12px; }
.copy details { margin-top: 10px; font-size: 13px; }
.copy pre { white-space: pre-wrap; font-family: inherit; background: rgba(255, 255, 255, .6); padding: 12px; border-radius: 6px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 8px; }
td, th { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
th { color: #64748b; font-weight: 600; }
</style>
