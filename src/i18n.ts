import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from '@/i18n/locales/ru.json'

void i18n.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'ru',
  supportedLngs: ['ru'],
  resources: { ru: { translation: ru } },
  interpolation: { escapeValue: false },
})

export default i18n
