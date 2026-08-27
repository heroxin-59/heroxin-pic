<script setup lang="ts">
import { ref } from 'vue'
import AccessGate from '@/components/AccessGate.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { isAccessGateEnabled, isAccessUnlocked } from '@/config/accessGate'

const unlocked = ref(!isAccessGateEnabled() || isAccessUnlocked())

function onUnlocked() {
  unlocked.value = true
}
</script>

<template>
  <AccessGate v-if="!unlocked" @unlocked="onUnlocked" />
  <AppLayout v-else />
</template>
