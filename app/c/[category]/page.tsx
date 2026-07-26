import { notFound } from 'next/navigation';
import { getCategory } from '@/lib/categories';
import CategoryClient from './category-client';

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat || cat.kind !== 'posts') notFound();
  // 이름·라벨은 클라이언트가 현재 언어로 직접 고른다
  return <CategoryClient slug={cat.slug} />;
}
