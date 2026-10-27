import SeoPage from "@/components/SeoPage";
import NotFound from "@/pages/not-found";
import { seoPageBySlug } from "@shared/seo-content";

export default function SeoLanding({ slug }: { slug: string }) {
  const page = seoPageBySlug.get(slug);
  if (!page) return <NotFound />;
  return <SeoPage page={page} />;
}
