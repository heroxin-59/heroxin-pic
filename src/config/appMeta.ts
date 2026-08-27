import { resolveAppTitle } from '@/config/appTitle'

export { DEFAULT_APP_TITLE, resolveAppTitle } from '@/config/appTitle'

/** 界面展示用应用标题（来自 VITE_APP_TITLE） */
export const appTitle = resolveAppTitle(import.meta.env.VITE_APP_TITLE)
