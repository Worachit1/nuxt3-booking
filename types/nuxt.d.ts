// types/nuxt.d.ts
import { Pinia } from 'pinia'

declare module '#app' {
  interface NuxtApp {
    $pinia: Pinia
  }
}
