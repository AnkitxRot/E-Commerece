import type { Prisma, PrismaClient } from '@prisma/client';
import { heroContentSchema } from '@audio-commerce/shared';

type VariantSpec = {
  sku: string;
  attributes: Record<string, string>;
  stockQty: number;
  priceOverride?: string;
};

type ProductSpec = {
  slug: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  basePrice: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  variants: VariantSpec[];
};

const HERO = heroContentSchema.parse({
  title: 'Listen closer',
  subtitle: 'Reference headphones and desktop audio, voiced for long sessions.',
  imageUrl: 'https://picsum.photos/seed/aurelia-hero/1600/900',
  ctaLabel: 'Shop headphones',
  ctaHref: '/c/headphones',
});

const PRODUCTS: ProductSpec[] = [
  {
    slug: 'aurelia-nova',
    name: 'Aurelia Nova',
    description:
      'Open-back over-ears with a wide stage and a composed low end. The house reference for mixing at home and late-night listening.',
    category: 'over-ear',
    brand: 'aurelia',
    basePrice: '44990.00',
    status: 'ACTIVE',
    featured: true,
    seoTitle: 'Aurelia Nova open-back headphones',
    seoDescription: 'Flagship open-back headphones with a wide stage, in stock now.',
    variants: [
      { sku: 'NOV-BLK-00', attributes: { color: 'Obsidian' }, stockQty: 18 },
      { sku: 'NOV-SLV-00', attributes: { color: 'Silver' }, stockQty: 9 },
    ],
  },
  {
    slug: 'sable-ion',
    name: 'Sable Ion',
    description:
      'A compact in-ear with a crystalline treble and a detachable cable. The clear-shell run carries a limited finish surcharge.',
    category: 'in-ear',
    brand: 'sable',
    basePrice: '18990.00',
    status: 'ACTIVE',
    featured: true,
    variants: [
      { sku: 'ION-BLK-00', attributes: { color: 'Graphite' }, stockQty: 14 },
      {
        sku: 'ION-CLR-00',
        attributes: { color: 'Clear' },
        stockQty: 6,
        priceOverride: '21990.00',
      },
    ],
  },
  {
    slug: 'northwind-restock',
    name: 'Northwind Restock',
    description:
      'Closed-back isolation with a dense, even bass. The current production lot is sold through; we are holding the listing until the next crate lands.',
    category: 'over-ear',
    brand: 'northwind',
    basePrice: '32990.00',
    status: 'ACTIVE',
    variants: [
      { sku: 'RST-BLK-00', attributes: { color: 'Charcoal' }, stockQty: 0 },
      { sku: 'RST-SLV-00', attributes: { color: 'Frost' }, stockQty: 0 },
    ],
  },
  {
    slug: 'helix-lineage',
    name: 'Helix Lineage',
    description:
      'A planar over-ear with interchangeable pads. Midnight remains on the shelf; ivory is waiting on the next finishing batch.',
    category: 'over-ear',
    brand: 'helix',
    basePrice: '52990.00',
    status: 'ACTIVE',
    variants: [
      { sku: 'LIN-BLK-00', attributes: { color: 'Midnight' }, stockQty: 11 },
      { sku: 'LIN-IVY-00', attributes: { color: 'Ivory' }, stockQty: 0 },
    ],
  },
  {
    slug: 'aurelia-lab-prototype',
    name: 'Aurelia Lab Prototype',
    description:
      'An unfinished open-back study from the lab bench. Not offered for sale and not listed on the public floor.',
    category: 'over-ear',
    brand: 'aurelia',
    basePrice: '99990.00',
    status: 'DRAFT',
    variants: [{ sku: 'LAB-BLK-00', attributes: { color: 'Unfinished' }, stockQty: 1 }],
  },
  {
    slug: 'helix-classic-v1',
    name: 'Helix Classic V1',
    description:
      'The first Classic chassis, retired when the revised yoke entered production. Kept on file for service history only.',
    category: 'over-ear',
    brand: 'helix',
    basePrice: '27990.00',
    status: 'ARCHIVED',
    variants: [{ sku: 'CLS-BLK-00', attributes: { color: 'Black' }, stockQty: 0 }],
  },
  {
    slug: 'aurelia-luna',
    name: 'Aurelia Luna',
    description: 'Closed-back travel headphones with a calm midrange and a folding yoke that survives a week of flights.',
    category: 'over-ear',
    brand: 'aurelia',
    basePrice: '28990.00',
    status: 'ACTIVE',
    featured: true,
    variants: [{ sku: 'LUN-BLK-00', attributes: { color: 'Night' }, stockQty: 22 }],
  },
  {
    slug: 'aurelia-drift',
    name: 'Aurelia Drift',
    description: 'Lightweight open-backs for long score-study sessions, with a gentle treble that does not fatigue.',
    category: 'over-ear',
    brand: 'aurelia',
    basePrice: '21990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'DFT-WAL-00', attributes: { color: 'Walnut' }, stockQty: 15 }],
  },
  {
    slug: 'aurelia-quartz',
    name: 'Aurelia Quartz',
    description: 'A compact DAC with a quiet USB input and a line-out that stays composed into difficult amplifiers.',
    category: 'dacs',
    brand: 'aurelia',
    basePrice: '34990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'QTZ-SLV-00', attributes: { finish: 'Silver' }, stockQty: 8 }],
  },
  {
    slug: 'aurelia-current',
    name: 'Aurelia Current',
    description: 'A desktop headphone amplifier with generous current on tap and a stepped attenuator you can feel.',
    category: 'amplifiers',
    brand: 'aurelia',
    basePrice: '41990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'CUR-BLK-00', attributes: { finish: 'Black' }, stockQty: 7 }],
  },
  {
    slug: 'sable-veil',
    name: 'Sable Veil',
    description: 'Custom-fit style universal IEMs with a dark, velvety midrange for vocal-forward playlists.',
    category: 'in-ear',
    brand: 'sable',
    basePrice: '24990.00',
    status: 'ACTIVE',
    featured: true,
    variants: [{ sku: 'VEL-BRN-00', attributes: { color: 'Espresso' }, stockQty: 10 }],
  },
  {
    slug: 'sable-ember',
    name: 'Sable Ember',
    description: 'Warm in-ears with a copper-tinted shell and a cable that resists tangle in a jacket pocket.',
    category: 'in-ear',
    brand: 'sable',
    basePrice: '12990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'EMB-CPR-00', attributes: { color: 'Copper' }, stockQty: 30 }],
  },
  {
    slug: 'sable-harbor',
    name: 'Sable Harbor',
    description: 'A balanced 4.4 mm cable with a quiet, flexible jacket for daily commute duty.',
    category: 'cables',
    brand: 'sable',
    basePrice: '6990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'HBR-BAL-00', attributes: { termination: '4.4mm' }, stockQty: 40 }],
  },
  {
    slug: 'sable-mirage',
    name: 'Sable Mirage',
    description: 'Semi-open over-ears that keep a hint of room air without leaking too much onto a quiet train.',
    category: 'over-ear',
    brand: 'sable',
    basePrice: '26990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'MRG-GRY-00', attributes: { color: 'Mist' }, stockQty: 12 }],
  },
  {
    slug: 'northwind-fjord',
    name: 'Northwind Fjord',
    description: 'Rugged closed-backs with replaceable pads and a clamp that stays honest after a winter of studio use.',
    category: 'over-ear',
    brand: 'northwind',
    basePrice: '24990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'FJD-GRN-00', attributes: { color: 'Pine' }, stockQty: 16 }],
  },
  {
    slug: 'northwind-aurora',
    name: 'Northwind Aurora',
    description: 'A ladder-DAC with a slow, analogue roll-off and a transformer-coupled output.',
    category: 'dacs',
    brand: 'northwind',
    basePrice: '58990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'AUR-BRS-00', attributes: { finish: 'Brass' }, stockQty: 4 }],
  },
  {
    slug: 'northwind-glacier',
    name: 'Northwind Glacier',
    description: 'A Class A headphone amplifier that runs cool enough for a closed cabinet and stays silent at idle.',
    category: 'amplifiers',
    brand: 'northwind',
    basePrice: '46990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'GLC-WHT-00', attributes: { finish: 'Ice' }, stockQty: 5 }],
  },
  {
    slug: 'northwind-strand',
    name: 'Northwind Strand',
    description: 'A single-crystal copper interconnect for DAC-to-amp duty, finished with low-mass connectors.',
    category: 'cables',
    brand: 'northwind',
    basePrice: '8990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'STN-RCA-00', attributes: { termination: 'RCA' }, stockQty: 25 }],
  },
  {
    slug: 'helix-summit',
    name: 'Helix Summit',
    description: 'A balanced desktop amplifier with generous headroom for stubborn planars.',
    category: 'amplifiers',
    brand: 'helix',
    basePrice: '62990.00',
    status: 'ACTIVE',
    featured: true,
    variants: [{ sku: 'SMT-BLK-00', attributes: { finish: 'Graphite' }, stockQty: 6 }],
  },
  {
    slug: 'helix-orbit',
    name: 'Helix Orbit',
    description: 'A dual-mono DAC with an isolated USB board and a reconstructed filter you can actually hear as air, not glare.',
    category: 'dacs',
    brand: 'helix',
    basePrice: '54990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'ORB-SLV-00', attributes: { finish: 'Silver' }, stockQty: 5 }],
  },
  {
    slug: 'helix-cascade',
    name: 'Helix Cascade',
    description: 'Hybrid in-ears with a bone-conduction driver for texture that does not smear the vocal.',
    category: 'in-ear',
    brand: 'helix',
    basePrice: '31990.00',
    status: 'ACTIVE',
    variants: [{ sku: 'CSC-BLU-00', attributes: { color: 'Tide' }, stockQty: 9 }],
  },
  {
    slug: 'helix-filament',
    name: 'Helix Filament',
    description: 'A silver-plated headphone cable with a discreet chin slider and a locking 3.5 mm plug.',
    category: 'cables',
    brand: 'helix',
    basePrice: '5490.00',
    status: 'ACTIVE',
    variants: [{ sku: 'FIL-35M-00', attributes: { termination: '3.5mm' }, stockQty: 33 }],
  },
];

async function upsertCategory(
  prisma: PrismaClient,
  slug: string,
  name: string,
  parentId: string | null = null,
) {
  return prisma.category.upsert({
    where: { slug },
    update: { name, parentId },
    create: { slug, name, parentId },
  });
}

async function upsertBrand(prisma: PrismaClient, slug: string, name: string) {
  return prisma.brand.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });
}

function imageUrl(slug: string, n: number) {
  return `https://picsum.photos/seed/${slug}-${n}/800/800`;
}

async function upsertProduct(
  prisma: PrismaClient,
  spec: ProductSpec,
  categoryId: string,
  brandId: string,
) {
  const fields = {
    name: spec.name,
    description: spec.description,
    categoryId,
    brandId,
    basePrice: spec.basePrice,
    status: spec.status,
    featured: spec.featured ?? false,
    seoTitle: spec.seoTitle ?? null,
    seoDescription: spec.seoDescription ?? null,
  };

  const product = await prisma.product.upsert({
    where: { slug: spec.slug },
    update: fields,
    create: { slug: spec.slug, ...fields },
  });

  for (const variant of spec.variants) {
    const variantFields = {
      productId: product.id,
      attributes: variant.attributes as Prisma.InputJsonValue,
      priceOverride: variant.priceOverride ?? null,
      stockQty: variant.stockQty,
      reservedQty: 0,
    };
    await prisma.productVariant.upsert({
      where: { sku: variant.sku },
      update: variantFields,
      create: { sku: variant.sku, ...variantFields },
    });
  }

  await prisma.productImage.deleteMany({ where: { productId: product.id } });
  await prisma.productImage.createMany({
    data: [1, 2].map((n) => ({
      productId: product.id,
      url: imageUrl(spec.slug, n),
      altText: `${spec.name}, view ${n}`,
      position: n - 1,
    })),
  });
}

export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const headphones = await upsertCategory(prisma, 'headphones', 'Headphones');
  const homeAudio = await upsertCategory(prisma, 'home-audio', 'Home audio');
  const accessories = await upsertCategory(prisma, 'accessories', 'Accessories');
  const overEar = await upsertCategory(prisma, 'over-ear', 'Over-ear', headphones.id);
  const inEar = await upsertCategory(prisma, 'in-ear', 'In-ear', headphones.id);
  const dacs = await upsertCategory(prisma, 'dacs', 'DACs', homeAudio.id);
  const amplifiers = await upsertCategory(prisma, 'amplifiers', 'Amplifiers', homeAudio.id);
  const cables = await upsertCategory(prisma, 'cables', 'Cables', accessories.id);

  const categories: Record<string, { id: string }> = {
    headphones,
    'home-audio': homeAudio,
    accessories,
    'over-ear': overEar,
    'in-ear': inEar,
    dacs,
    amplifiers,
    cables,
  };

  const [aurelia, sable, northwind, helix] = await Promise.all([
    upsertBrand(prisma, 'aurelia', 'Aurelia'),
    upsertBrand(prisma, 'sable', 'Sable'),
    upsertBrand(prisma, 'northwind', 'Northwind'),
    upsertBrand(prisma, 'helix', 'Helix'),
  ]);
  const brands: Record<string, { id: string }> = { aurelia, sable, northwind, helix };

  for (const spec of PRODUCTS) {
    const category = categories[spec.category];
    const brand = brands[spec.brand];
    if (!category || !brand) throw new Error(`Unknown category or brand for ${spec.slug}`);
    await upsertProduct(prisma, spec, category.id, brand.id);
  }

  await prisma.contentBlock.deleteMany();
  await prisma.contentBlock.createMany({
    data: [
      {
        type: 'BANNER',
        position: 0,
        active: true,
        payload: {
          title: 'Quiet rooms, honest playback',
          subtitle: 'Headphones, DACs, and amplifiers chosen for tone — not spec sheets.',
          ctaLabel: 'Browse the floor',
          ctaHref: '/products',
        },
      },
      {
        type: 'ANNOUNCEMENT',
        position: 1,
        active: true,
        payload: {
          message: 'Complimentary insured shipping on orders above ₹15,000 this month.',
          href: '/products',
        },
      },
      {
        type: 'FEATURED_COLLECTION',
        position: 2,
        active: true,
        payload: {
          title: 'Staff picks',
          productSlugs: ['aurelia-nova', 'sable-ion', 'helix-summit', 'sable-veil'],
        },
      },
    ],
  });

  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: {
      storeName: 'Aurelia Audio',
      contactEmail: 'hello@aureliaaudio.demo',
      heroContent: HERO,
    },
    create: {
      id: 'singleton',
      storeName: 'Aurelia Audio',
      contactEmail: 'hello@aureliaaudio.demo',
      heroContent: HERO,
    },
  });
}
