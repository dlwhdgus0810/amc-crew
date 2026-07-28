'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category } from '@/lib/categories';
import CategoryCard from './category-card';

/**
 * 홈의 즐겨찾기 카드 — dnd-kit으로 순서를 바꾼다.
 * 손잡이(⠿)에만 드래그를 걸어, 카드 본체는 평소처럼 링크로 눌린다.
 */
export default function SortableCategoryCard({
  category,
  reorderLabel,
  ...cardProps
}: {
  category: Category;
  reorderLabel: string;
  showToggles: boolean;
  isFavorite: boolean;
  isSubscribed: boolean;
  onFavorite: () => void;
  onSubscribe: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.slug,
  });

  return (
    <CategoryCard
      {...cardProps}
      category={category}
      nodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // 끄는 카드는 위로 올려 다른 카드에 가리지 않게 한다
        ...(isDragging ? { zIndex: 2, position: 'relative' as const } : {}),
      }}
      dragging={isDragging}
      dragHandle={
        <button
          className="car-drag"
          aria-label={reorderLabel}
          {...attributes}
          {...listeners}
          // 손잡이는 카드 링크 안에 있으므로 클릭이 이동으로 새지 않게 막는다
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          // 길게 눌러 순서를 바꿀 때 링크 메뉴("링크 복사")가 뜨지 않도록
          onContextMenu={(e) => e.preventDefault()}
        >
          ⠿
        </button>
      }
    />
  );
}
