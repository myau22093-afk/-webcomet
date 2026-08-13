import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/login",
          "/register",
          "/payment",
          "/forgot-password",
          "/reset-password",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: "https://webcomet.ru/sitemap.xml",
    host: "https://webcomet.ru",
  };
}
