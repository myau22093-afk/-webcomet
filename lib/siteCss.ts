/** Google Fonts @import ломается, если перед ним другие CSS-правила — выносим в <link> */
export function prepareCssForHtml(css: string): {
  css: string;
  headLinks: string[];
} {
  const headLinks: string[] = [];
  let rest = css || "";

  rest = rest.replace(
    /@import\s+url\(\s*['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)['"]?\s*\)\s*;?/gi,
    (_m, url: string) => {
      headLinks.push(url);
      return "";
    }
  );
  rest = rest.replace(
    /@import\s+['"](https:\/\/fonts\.googleapis\.com[^'"]+)['"]\s*;?/gi,
    (_m, url: string) => {
      headLinks.push(url);
      return "";
    }
  );

  const hoisted: string[] = [];
  rest = rest.replace(/@import[^;]+;/gi, (match) => {
    hoisted.push(match.trim());
    return "";
  });

  const cssOut = [...hoisted, rest.trim()].filter(Boolean).join("\n");
  return { css: cssOut, headLinks: [...new Set(headLinks)] };
}

export function buildFontLinkTags(urls: string[]): string {
  return urls
    .map(
      (href) =>
        `<link rel="stylesheet" href="${href.replace(/"/g, "&quot;")}" />`
    )
    .join("\n  ");
}
