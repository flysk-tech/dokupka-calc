<template>
  <div class="field">
    <Text size="m" :theme="TextSecondaryLightTheme" class="field-label">{{ label }}</Text>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { Text, TextSecondaryLightTheme } from '@flysk-tech/amocrm-kommo-vue-ui-kit'

defineProps<{ label: string }>()
</script>

<style scoped>
.field-label { display: block; margin-bottom: 6px; }
</style>
