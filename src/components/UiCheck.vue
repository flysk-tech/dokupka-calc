<template>
  <Label :theme="CheckboxLabelTheme" text-placement="right" :is-centered="true" :text="label">
    <Checkbox :theme="CheckboxLightTheme" :is-checked="modelValue" @change="onChange" />
  </Label>
</template>

<script setup lang="ts">
import { Checkbox, CheckboxLightTheme, CheckboxLabelTheme, Label } from '@flysk-tech/amocrm-kommo-vue-ui-kit'

defineProps<{ modelValue: boolean, label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const onChange = (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked)
</script>
