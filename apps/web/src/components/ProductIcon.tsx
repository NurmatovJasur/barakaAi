import clsx from 'clsx';
import { Apple, Carrot, Droplet, Milk, Package, Wheat, Candy, CookingPot } from 'lucide-react';
import type { CategorySlug } from '@smp/shared';

const ICONS: Record<CategorySlug, typeof Apple> = {
  vegetables: Carrot,
  fruits: Apple,
  grains: CookingPot,
  flour: Wheat,
  sugar: Candy,
  oil: Droplet,
  dairy: Milk,
  other: Package,
};

const TONES: Record<CategorySlug, string> = {
  vegetables: 'bg-[#e7f6ec] text-[#15803d]',
  fruits: 'bg-[#fdecec] text-[#b91c1c]',
  grains: 'bg-[#fdf3e2] text-[#b45309]',
  flour: 'bg-[#f5efe6] text-[#8a6a3b]',
  sugar: 'bg-[#f3eefc] text-[#6d28d9]',
  oil: 'bg-[#fef9c3] text-[#a16207]',
  dairy: 'bg-[#e8eefb] text-[#1e3a8a]',
  other: 'bg-[#eef2f6] text-[#475569]',
};

export function ProductIcon({ category, size = 'md' }: { category: CategorySlug; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[category] ?? Package;
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-lg',
        TONES[category],
        size === 'sm' && 'size-8',
        size === 'md' && 'size-10',
        size === 'lg' && 'size-14 rounded-xl',
      )}
    >
      <Icon className={size === 'lg' ? 'size-7' : size === 'sm' ? 'size-4' : 'size-5'} />
    </div>
  );
}
