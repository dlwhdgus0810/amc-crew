import { notFound } from 'next/navigation';
import { getCategory } from '@/lib/categories';
import CategoryClient from './category-client';

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat || cat.kind !== 'posts') notFound();
  return <CategoryClient slug={cat.slug} name={cat.name} emoji={cat.emoji} />;
}
