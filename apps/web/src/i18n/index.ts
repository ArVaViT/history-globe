import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ru from "./ru.json";

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: "ru",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
