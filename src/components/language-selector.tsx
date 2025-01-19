'use client';

import { useEffect } from 'react';

declare global {
    interface Window {
        google: {
            translate: {
                TranslateElement: new (
                    options: {
                        pageLanguage: string;
                        includedLanguages?: string;
                        layout?: any;
                        autoDisplay?: boolean;
                    },
                    elementId: string
                ) => void;
                InlineLayout: {
                    SIMPLE: any;
                };
            };
        };
        googleTranslateElementInit: () => void;
    }
}

export function LanguageSelector() {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        script.defer = true;

        window.googleTranslateElementInit = () => {
            if (window.google && window.google.translate) {
                new window.google.translate.TranslateElement(
                    {
                        pageLanguage: 'bs',
                        includedLanguages: 'en,de,hr,sr,bs',
                        layout: window.google.translate.InlineLayout.SIMPLE,
                        autoDisplay: false,
                    },
                    'google_translate_element'
                );
            }
        };

        document.body.appendChild(script);

        return () => {
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            delete window.googleTranslateElementInit;
        };
    }, []);

    return (
        <div className="inline-flex items-center justify-center">
            <div
                id="google_translate_element"
                className="goog-te-gadget"
                style={{ border: 'none' }}
            />
        </div>
    );
}
