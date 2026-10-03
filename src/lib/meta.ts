export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · AUTODRIVE DMS` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · AUTODRIVE DMS` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
