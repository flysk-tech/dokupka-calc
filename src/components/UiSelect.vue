<template>
  <Select :theme="SelectRootTheme" :value="current" @change="onChange">
    <SelectTrigger :theme="SelectButtonLightTheme">
      <SelectValue :placeholder="placeholder" />
      <SelectArrow :theme="SelectArrowTheme" />
    </SelectTrigger>
    <SelectList :theme="SelectListTheme">
      <SelectItem
        v-for="(item, index) in items"
        :key="item.value"
        :theme="SelectItemTheme"
        :item="item"
        :index="index"
      />
    </SelectList>
  </Select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Select, SelectTrigger, SelectList, SelectItem, SelectValue, SelectArrow,
  SelectRootTheme, SelectButtonLightTheme, SelectListTheme, SelectItemTheme, SelectArrowTheme
} from '@flysk-tech/amocrm-kommo-vue-ui-kit'

interface Item { value: string | number, option: string }

const props = defineProps<{ items: Item[], modelValue: string | number, placeholder?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>()

const current = computed(() => props.items.find(i => i.value === props.modelValue))
const onChange = (item: Item) => emit('update:modelValue', item.value)
</script>
