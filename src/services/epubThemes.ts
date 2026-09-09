export type EpubTheme = "serif" | "sans" | "dark";

export const EPUB_THEMES: Record<EpubTheme, string> = {
  serif: `body{font-family:Georgia,"Times New Roman",serif;line-height:1.65;margin:1.4em;color:#1a1a1a;}
h1,h2,h3{font-family:Georgia,serif;page-break-after:avoid;margin-top:1.4em;}
p{margin:0 0 1em;text-indent:1.5em;}
p:first-of-type{text-indent:0;}`,
  sans: `body{font-family:"Helvetica Neue",Arial,sans-serif;line-height:1.55;margin:1.2em;color:#222;}
h1,h2,h3{page-break-after:avoid;font-weight:600;}
p{margin:0 0 0.9em;}`,
  dark: `body{font-family:Georgia,serif;line-height:1.65;margin:1.4em;background:#121212;color:#e8e8e8;}
h1,h2,h3{color:#f5f5f5;page-break-after:avoid;}
p{margin:0 0 1em;}`,
};

export function epubCss(theme: EpubTheme): string {
  return EPUB_THEMES[theme] || EPUB_THEMES.serif;
}
