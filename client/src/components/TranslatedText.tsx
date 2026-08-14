import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Cache to prevent repetitive API calls during the session
const translationCache: Record<string, string> = {};

export default function TranslatedText({ text }: { text: string }) {
  const { i18n } = useTranslation();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (!text) return;
    const lang = i18n.language || 'es';
    
    // Asumimos que el contenido original de la base de datos está en español
    if (lang === 'es') {
      setTranslated(text);
      return;
    }

    const cacheKey = `${lang}:${text}`;
    if (translationCache[cacheKey]) {
      setTranslated(translationCache[cacheKey]);
      return;
    }

    const fetchTranslation = async () => {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`);
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        
        let result = "";
        // Google Translate returns an array of chunks
        if (data && data[0]) {
          result = data[0].map((item: any) => item[0]).join('');
        } else {
          result = text;
        }

        translationCache[cacheKey] = result;
        setTranslated(result);
      } catch (err) {
        console.error("Translation error:", err);
        setTranslated(text); // Fallback to original
      }
    };

    // Small delay to prevent rate limiting when many components render at once
    const timeoutId = setTimeout(fetchTranslation, 100);
    return () => clearTimeout(timeoutId);
  }, [text, i18n.language]);

  return <>{translated}</>;
}
