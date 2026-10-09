import type { Metadata } from 'next';
import { SITE_URL, postUrl } from '@/lib/site';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const res = await fetch(`${API_URL}/v1/posts/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error();
    const post = await res.json();
    const title = `${post.author?.displayName ?? 'Bai viet'} tren travelvietplaner`;
    const description = post.body?.slice(0, 160) || title;
    const image = post.media?.[0]?.url
      ? post.media[0].url.startsWith('/')
        ? `${SITE_URL}${post.media[0].url}`
        : post.media[0].url
      : undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: postUrl(id),
        type: 'article',
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
