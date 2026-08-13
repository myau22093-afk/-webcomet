import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://webcomet.ru";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/requisites`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/hosting`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
