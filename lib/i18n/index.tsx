import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';
import { id } from './id';
import { zh } from './zh';
import { es } from './es';
import { hi } from './hi';
import { pt } from './pt';
import { ru } from './ru';
import { ja } from './ja';
import { de } from './de';
import { fr } from './fr';
import { ko } from './ko';
import { vi } from './vi';
import { th } from './th';
import { ms } from './ms';

/**
 * Languages the app ships, in picker order (most spoken first after English/Indonesian).
 * `native` is shown as-is in every language so people can find their own.
 * Arabic waits for right-to-left layout support.
 */
export const LANGUAGES = [
  { code: 'en', native: 'English' },
  { code: 'id', native: 'Bahasa Indonesia' },
  { code: 'zh', native: '中文（简体）' },
  { code: 'es', native: 'Español' },
  { code: 'hi', native: 'हिन्दी' },
  { code: 'pt', native: 'Português' },
  { code: 'ru', native: 'Русский' },
  { code: 'ja', native: '日本語' },
  { code: 'de', native: 'Deutsch' },
  { code: 'fr', native: 'Français' },
  { code: 'ko', native: '한국어' },
  { code: 'vi', native: 'Tiếng Việt' },
  { code: 'th', native: 'ไทย' },
  { code: 'ms', native: 'Bahasa Melayu' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.code === v);

/** Account value ("JA") ↔ app value ("ja"). */
export const toAccountLanguage = (l: Language) => l.toUpperCase() as Uppercase<Language>;
export const fromAccountLanguage = (v: string | null | undefined): Language | null => {
  const l = v?.toLowerCase();
  return isLanguage(l) ? l : null;
};

const STORAGE_KEY = 'manuver.language';
const dictionaries = { en, id, zh, es, hi, pt, ru, ja, de, fr, ko, vi, th, ms } as const;

// Dot-path keys derived from the English dictionary (source of truth).
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<typeof en>;
export type TParams = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: any = dict;
  for (const part of key.split('.')) {
    if (node == null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params?: TParams) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Non-hook translate, for code outside React (Alerts in helpers etc.). */
let currentLanguage: Language = 'en';
export function translate(key: TKey, params?: TParams, lang: Language = currentLanguage) {
  const text = lookup(dictionaries[lang], key) ?? lookup(en, key) ?? key;
  return interpolate(text, params);
}

type Ctx = {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: TKey, params?: TParams) => string;
};

const LanguageContext = createContext<Ctx>({
  language: 'en',
  setLanguage: () => {},
  t: (key, params) => translate(key, params, 'en'),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Start from the phone's language when the app has it (else English); a stored choice or
  // the account's language overrides it.
  const [language, setLang] = useState<Language>(() => {
    let initial: Language = 'en';
    try {
      const base = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().split(/[-_]/)[0];
      // "in" is the legacy code some Android versions still report for Indonesian.
      const code = base === 'in' ? 'id' : base;
      if (isLanguage(code)) initial = code;
    } catch {}
    currentLanguage = initial;
    return initial;
  });

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (alive && isLanguage(v)) {
          currentLanguage = v;
          setLang(v);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback((l: Language) => {
    currentLanguage = l;
    setLang(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({ language, setLanguage, t: (key, params) => translate(key, params, language) }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

/**
 * Sport ids from the database ("badminton", "lari") → display name in the current
 * language. Unknown values (free-text sports) are shown as they were typed.
 */
export function useSportName() {
  const t = useT();
  return (raw: string) => {
    const id = raw.trim();
    const key = `sports.${id.toLowerCase()}` as TKey;
    const label = t(key);
    return label === key ? id : label;
  };
}
