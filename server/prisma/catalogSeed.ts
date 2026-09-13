import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { heroContentSchema } from '@audio-commerce/shared';
import { COMMONS_IMAGE_MAP } from './commonsImageMap.js';

type VariantSpec = {
  sku: string;
  attributes: Record<string, string>;
  stockQty: number;
  priceOverride?: string;
  compareAtPrice?: string;
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
  specs?: Record<string, string>;
  /** Explicit image URLs (used for the new non-audio catalog). Falls back to seeded picsum images when omitted. */
  images?: { url: string; altText: string }[];
  variants: VariantSpec[];
};

const HERO = heroContentSchema.parse({
  title: 'Everyday, elevated',
  subtitle: 'Thoughtfully chosen electronics, home, fitness, and travel essentials — built to last, priced to make sense.',
  imageUrl: 'https://picsum.photos/seed/everyday-hero/1600/900',
  ctaLabel: 'Shop all products',
  ctaHref: '/products',
});

function commons(file: string, alt: string): { url: string; altText: string } {
  const url = COMMONS_IMAGE_MAP[file];
  if (!url) throw new Error(`No resolved Commons CDN URL for "${file}" — add it to commonsImageMap.ts`);
  return { url, altText: alt };
}

const OVER_EAR_IMAGES = (name: string) => [
  commons('Sennheiser_HD_598_over-ear_headphones_(31514940057).jpg', `${name}, over-ear headphones`),
  commons('Harman_AKG_N20_headphones_.jpg', `${name}, side view`),
];
const IN_EAR_IMAGES = (name: string) => [
  commons("Velodyne's_vPulse_in-ear_headphones.jpg", `${name}, in-ear headphones`),
  commons('Latitude_Wireless_Earbuds.jpg', `${name}, earbuds detail`),
];
const DAC_IMAGES = (name: string) => [
  commons('DAC_in_the_box.jpg', `${name}, desktop DAC`),
  commons('Maurer_308_DAC.jpg', `${name}, DAC rear detail`),
];
const AMPLIFIER_IMAGES = (name: string) => [
  commons('Little_Dot_MK_IV_Tube_Headphone_Amplifier_Pre-amplifier.jpg', `${name}, desktop amplifier`),
  commons('Rear_panel_of_audio_Hi-Fi_stereo_amplifier_Denon_PMA-980R.jpg', `${name}, amplifier rear connections`),
];
const CABLE_IMAGES = (name: string) => [
  commons('Klotz_cables_RCA.jpg', `${name}, audio cable`),
  commons(
    'One_white_RCA_connector_(plug,_male)_from_a_standard_RCA_cable_with_white_and_red_plugs_for_left_and_right.jpg',
    `${name}, connector detail`,
  ),
];

// The original single-vertical audio catalog. Descriptions and specs are
// untouched — still a coherent, well-specified product line, now nested under
// the broader "audio" category — but images are replaced below: they
// previously came from picsum.photos (an arbitrary random-photo service) and
// did not depict the products at all (e.g. a DAC listing showed a photo of
// the Leaning Tower of Pisa). Real, category-matched Commons photos fix that.
const AUDIO_PRODUCTS: ProductSpec[] = [
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
    images: OVER_EAR_IMAGES('Aurelia Nova'),
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
    images: IN_EAR_IMAGES('Sable Ion'),
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
    images: OVER_EAR_IMAGES('Northwind Restock'),
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
    images: OVER_EAR_IMAGES('Helix Lineage'),
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
    images: OVER_EAR_IMAGES('Aurelia Lab Prototype'),
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
    images: OVER_EAR_IMAGES('Helix Classic V1'),
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
    images: OVER_EAR_IMAGES('Aurelia Luna'),
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
    images: OVER_EAR_IMAGES('Aurelia Drift'),
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
    images: DAC_IMAGES('Aurelia Quartz'),
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
    images: AMPLIFIER_IMAGES('Aurelia Current'),
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
    images: IN_EAR_IMAGES('Sable Veil'),
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
    images: IN_EAR_IMAGES('Sable Ember'),
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
    images: CABLE_IMAGES('Sable Harbor'),
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
    images: OVER_EAR_IMAGES('Sable Mirage'),
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
    images: OVER_EAR_IMAGES('Northwind Fjord'),
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
    images: DAC_IMAGES('Northwind Aurora'),
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
    images: AMPLIFIER_IMAGES('Northwind Glacier'),
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
    images: CABLE_IMAGES('Northwind Strand'),
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
    images: AMPLIFIER_IMAGES('Helix Summit'),
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
    images: DAC_IMAGES('Helix Orbit'),
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
    images: IN_EAR_IMAGES('Helix Cascade'),
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
    images: CABLE_IMAGES('Helix Filament'),
    variants: [{ sku: 'FIL-35M-00', attributes: { termination: '3.5mm' }, stockQty: 33 }],
  },
];

// The broader "everyday objects" marketplace catalog. All images are real,
// freely-licensed photographs from Wikimedia Commons (stable URLs, verified to
// resolve before use) rather than random or placeholder imagery.
const MARKETPLACE_PRODUCTS: ProductSpec[] = [
  // Electronics
  {
    slug: 'portable-power-bank',
    name: 'Everyday Portable Power Bank 20,000mAh',
    description:
      'A high-capacity power bank for keeping phones, tablets, and laptops charged on the go, with dual output ports and an LED charge indicator.',
    category: 'electronics',
    brand: 'everyday',
    basePrice: '2499.00',
    status: 'ACTIVE',
    featured: true,
    specs: { Capacity: '20,000mAh', Output: '18W USB-C PD, 12W USB-A', Ports: '1x USB-C, 2x USB-A', Weight: '395g' },
    images: [
      commons('Power_bank.JPG', 'Portable power bank'),
      commons('Charging_smartphone_with_powerbank_20180312.jpg', 'A smartphone charging from a portable power bank'),
    ],
    variants: [{ sku: 'EVD-PWR-20K', attributes: { Color: 'Charcoal' }, stockQty: 40 }],
  },
  {
    slug: 'bluetooth-portable-speaker',
    name: 'Everyday Portable Bluetooth Speaker',
    description: 'A compact, splash-resistant speaker with 12 hours of battery life, built for outdoor listening.',
    category: 'electronics',
    brand: 'everyday',
    basePrice: '2999.00',
    status: 'ACTIVE',
    specs: { 'Battery Life': '12 hours', 'Water Resistance': 'IPX6', Connectivity: 'Bluetooth 5.0', Weight: '540g' },
    images: [commons('Bluetooth_Speaker.jpg', 'Portable Bluetooth speaker'), commons('Elite_Wireless_Speaker.jpg', 'Wireless speaker, side view')],
    variants: [{ sku: 'EVD-SPK-BT', attributes: { Color: 'Black' }, stockQty: 25, compareAtPrice: '3499.00' }],
  },
  {
    slug: 'digital-alarm-clock',
    name: 'Everyday Digital Alarm Clock',
    description: 'A bedside clock with a large LED display, dual alarms, and dimmable brightness for nighttime use.',
    category: 'electronics',
    brand: 'everyday',
    basePrice: '899.00',
    status: 'ACTIVE',
    specs: { Display: 'LED, dimmable', Alarms: 'Dual alarm', Power: 'AC with battery backup' },
    images: [commons('Digital-clock-alarm.jpg', 'Digital alarm clock showing the time'), commons('Blue_alarm_clock_(3).jpg', 'Digital alarm clock with blue display')],
    variants: [{ sku: 'EVD-CLK-DIG', attributes: {}, stockQty: 60 }],
  },
  {
    slug: 'full-hd-webcam',
    name: 'Everyday Full HD Webcam',
    description: 'A 1080p USB webcam with a built-in noise-reducing microphone for video calls and streaming.',
    category: 'electronics',
    brand: 'everyday',
    basePrice: '2199.00',
    status: 'ACTIVE',
    specs: { Resolution: '1080p @ 30fps', 'Field of view': '78°', Microphone: 'Built-in, noise-reducing', Connector: 'USB-A' },
    images: [commons('Webcam.JPG', 'USB webcam'), commons('USB_webcam_for_PC.jpg', 'USB webcam connected to a computer')],
    variants: [
      { sku: 'EVD-CAM-BLK', attributes: { Color: 'Black' }, stockQty: 18 },
      { sku: 'EVD-CAM-WHT', attributes: { Color: 'White' }, stockQty: 0 },
    ],
  },
  // Computers & Accessories
  {
    slug: 'mechanical-keyboard',
    name: 'Everyday Mechanical Keyboard',
    description: 'A tactile mechanical keyboard with hot-swappable switches and per-key backlighting for long typing sessions.',
    category: 'computers',
    brand: 'everyday',
    basePrice: '5999.00',
    status: 'ACTIVE',
    featured: true,
    specs: {
      'Switch type': 'Hot-swappable mechanical',
      Backlight: 'RGB per-key',
      Connectivity: 'USB-C wired + Bluetooth',
      Layout: 'Tenkeyless / Full-size',
    },
    images: [
      commons('Keychron_K8_Non-Backlight_Wireless_Mechanical_Keyboard.jpg', 'Mechanical keyboard, tenkeyless layout'),
      commons('Keychron_K4_mechanical_keyboard.jpg', 'Mechanical keyboard, full-size layout'),
    ],
    variants: [
      { sku: 'EVD-KEY-TKL', attributes: { Layout: 'Tenkeyless' }, stockQty: 12 },
      { sku: 'EVD-KEY-FULL', attributes: { Layout: 'Full-size' }, stockQty: 9, compareAtPrice: '6799.00' },
    ],
  },
  {
    slug: 'wireless-mouse',
    name: 'Everyday Wireless Mouse',
    description: 'An ergonomic wireless mouse with silent clicks and up to two years of battery life on a single AA cell.',
    category: 'computers',
    brand: 'everyday',
    basePrice: '1499.00',
    status: 'ACTIVE',
    specs: { Connectivity: '2.4GHz wireless', 'Battery life': 'Up to 24 months', DPI: '1600', Buttons: '6 programmable' },
    images: [commons('Wireless_mouse.jpg', 'Wireless computer mouse'), commons('Microsoft_Wireless_Mouse_5000-3.jpg', 'Wireless mouse, top view')],
    variants: [{ sku: 'EVD-MSE-WL', attributes: { Color: 'Black' }, stockQty: 50 }],
  },
  {
    slug: 'full-hd-monitor',
    name: 'Everyday 27" Full HD Monitor',
    description: 'A 27-inch IPS monitor with slim bezels, built for home offices and everyday computing.',
    category: 'computers',
    brand: 'everyday',
    basePrice: '12999.00',
    status: 'ACTIVE',
    featured: true,
    specs: { 'Screen size': '27 inch', Panel: 'IPS', Resolution: '1920x1080', 'Refresh rate': '75Hz', Ports: 'HDMI, VGA' },
    images: [commons('Computer_monitor.jpg', 'Desktop computer monitor'), commons('Average_Computer_Monitor.png', 'Computer monitor, front view')],
    variants: [{ sku: 'EVD-MON-27', attributes: {}, stockQty: 10, compareAtPrice: '15999.00' }],
  },
  // Home & Kitchen
  {
    slug: 'air-fryer',
    name: 'Everyday Air Fryer, 4.5L',
    description: 'A rapid hot-air fryer for crispy food with little to no oil, with a 4.5 liter nonstick basket.',
    category: 'home-kitchen',
    brand: 'everyday',
    basePrice: '5499.00',
    status: 'ACTIVE',
    featured: true,
    specs: { Capacity: '4.5 L', Power: '1400W', 'Temperature range': '80–200°C', Timer: 'Up to 60 minutes' },
    images: [commons('Air_Fryer_5458.jpg', 'Air fryer, closed'), commons('Air_Fryer_2020.jpg', 'Air fryer on a kitchen counter')],
    variants: [{ sku: 'EVD-FRY-45', attributes: { Color: 'Black' }, stockQty: 22, compareAtPrice: '6299.00' }],
  },
  {
    slug: 'french-press-coffee-maker',
    name: 'Everyday French Press Coffee Maker',
    description: 'A 1-liter borosilicate glass French press with a stainless steel mesh filter for full-bodied coffee.',
    category: 'home-kitchen',
    brand: 'everyday',
    basePrice: '1299.00',
    status: 'ACTIVE',
    specs: { Capacity: '1 L (34 oz)', Material: 'Borosilicate glass, stainless steel', Filter: 'Stainless steel mesh' },
    images: [commons('French_press.jpg', 'French press coffee maker'), commons('French_press_2020.jpg', 'French press, glass carafe')],
    variants: [{ sku: 'EVD-FRP-1L', attributes: {}, stockQty: 30 }],
  },
  {
    slug: 'electric-kettle',
    name: 'Everyday Electric Kettle, 1.7L',
    description: 'A fast-boil electric kettle with auto shut-off and a 1.7 liter capacity for tea and coffee.',
    category: 'home-kitchen',
    brand: 'everyday',
    basePrice: '1799.00',
    status: 'ACTIVE',
    specs: { Capacity: '1.7 L', Power: '1850W', 'Auto shut-off': 'Yes', Material: 'BPA-free body, stainless steel interior' },
    images: [commons('White_electric_kettle.JPG', 'Electric kettle'), commons('Electric-kettle.jpg', 'Electric kettle on a counter')],
    variants: [{ sku: 'EVD-KTL-17', attributes: { Color: 'White' }, stockQty: 0 }],
  },
  {
    slug: 'cast-iron-skillet',
    name: 'Everyday Cast Iron Skillet, 12-inch',
    description: 'A pre-seasoned cast iron skillet that builds a natural non-stick surface over time; oven-safe.',
    category: 'home-kitchen',
    brand: 'everyday',
    basePrice: '2199.00',
    status: 'ACTIVE',
    specs: {
      Diameter: '12 inch (30cm)',
      Material: 'Pre-seasoned cast iron',
      'Oven safe': 'Up to 260°C',
      Care: 'Hand wash, dry, and oil after each use',
    },
    images: [commons('Cast-Iron-Pan.jpg', 'Cast iron skillet'), commons('Cast_Iron_Pan_1_2019-01-27.jpg', 'Cast iron skillet, overhead view')],
    variants: [{ sku: 'EVD-SKL-12', attributes: {}, stockQty: 35, compareAtPrice: '2599.00' }],
  },
  // Fitness
  {
    slug: 'yoga-mat',
    name: 'Everyday Yoga Mat',
    description: 'A 6mm extra-cushioned non-slip yoga mat for home practice and studio classes.',
    category: 'fitness',
    brand: 'everyday',
    basePrice: '1499.00',
    status: 'ACTIVE',
    featured: true,
    specs: { Thickness: '6mm', Material: 'NBR foam', Length: '183cm', 'Non-slip surface': 'Both sides' },
    images: [commons('Yoga_mat.jpg', 'Yoga mat, rolled out'), commons('Top_view_of_a_woman_stretching_on_a_yoga_mat.jpg', 'Yoga mat in use during a stretch')],
    variants: [{ sku: 'EVD-YOGA-6MM', attributes: { Color: 'Teal' }, stockQty: 45 }],
  },
  {
    slug: 'adjustable-dumbbell-set',
    name: 'Everyday Dumbbell Set',
    description: 'Cast iron dumbbell pairs with a rubber coating and a knurled grip for strength training at home.',
    category: 'fitness',
    brand: 'everyday',
    basePrice: '2999.00',
    status: 'ACTIVE',
    specs: { Material: 'Cast iron with rubber coating', 'Weight options': '5kg, 10kg, 15kg pairs', Grip: 'Knurled ergonomic handle' },
    images: [
      commons('Heavy_Dumbbells_200_pound.JPG', 'Cast iron dumbbells'),
      commons('Close-up_Hand_holding_dumbbell_in_gym.jpg', 'Hand holding a dumbbell'),
    ],
    variants: [
      { sku: 'EVD-DMB-5', attributes: { Weight: '5kg' }, stockQty: 20 },
      { sku: 'EVD-DMB-10', attributes: { Weight: '10kg' }, stockQty: 14 },
      { sku: 'EVD-DMB-15', attributes: { Weight: '15kg' }, stockQty: 6 },
    ],
  },
  {
    slug: 'fitness-tracker-watch',
    name: 'Everyday Fitness Tracker Watch',
    description: 'A lightweight wrist tracker for steps, heart rate, and sleep, with up to 7 days of battery life.',
    category: 'fitness',
    brand: 'everyday',
    basePrice: '3499.00',
    status: 'ACTIVE',
    featured: true,
    specs: {
      'Battery life': 'Up to 7 days',
      Tracking: 'Steps, heart rate, sleep, SpO2',
      'Water resistance': '5 ATM',
      Display: '1.1 inch AMOLED',
    },
    images: [commons('Smartwatch.jpg', 'Fitness tracker watch'), commons('Smartwatch-828786.jpg', 'Fitness tracker watch on a wrist')],
    variants: [{ sku: 'EVD-FIT-WATCH', attributes: { Color: 'Black' }, stockQty: 28, compareAtPrice: '3999.00' }],
  },
  {
    slug: 'kettlebell',
    name: 'Everyday Cast Iron Kettlebell',
    description: 'A solid cast iron kettlebell with a wide, comfortable handle for swings, squats, and presses.',
    category: 'fitness',
    brand: 'everyday',
    basePrice: '1899.00',
    status: 'ACTIVE',
    specs: { Material: 'Solid cast iron', 'Weight options': '8kg, 12kg, 16kg', Handle: 'Wide powder-coated grip' },
    images: [commons('Kettlebell.JPG', 'Cast iron kettlebell'), commons('8kg_kettlebell.jpg', '8kg kettlebell')],
    variants: [
      { sku: 'EVD-KTB-8', attributes: { Weight: '8kg' }, stockQty: 15 },
      { sku: 'EVD-KTB-12', attributes: { Weight: '12kg' }, stockQty: 10 },
      { sku: 'EVD-KTB-16', attributes: { Weight: '16kg' }, stockQty: 5 },
    ],
  },
  // Travel
  {
    slug: 'hardshell-carry-on-suitcase',
    name: 'Everyday Carry-On Suitcase',
    description: 'A lightweight hardshell carry-on with 360° spinner wheels and a built-in TSA lock.',
    category: 'travel',
    brand: 'everyday',
    basePrice: '6499.00',
    status: 'ACTIVE',
    featured: true,
    specs: { Capacity: '38 L', Material: 'Polycarbonate shell', Wheels: '360° spinner (4)', Lock: 'Integrated TSA lock' },
    images: [
      commons('Suitcase.jpg', 'Hardshell carry-on suitcase'),
      commons('Struggling_with_Overpacking_a_Full_Suitcase.jpg', 'A suitcase packed for a trip'),
    ],
    variants: [{ sku: 'EVD-BAG-CARRYON', attributes: { Color: 'Navy' }, stockQty: 14, compareAtPrice: '7999.00' }],
  },
  {
    slug: 'hiking-travel-backpack',
    name: 'Everyday Travel Backpack, 40L',
    description: 'A durable 40-liter backpack with a padded laptop sleeve and rain cover, built for multi-day trips.',
    category: 'travel',
    brand: 'everyday',
    basePrice: '3999.00',
    status: 'ACTIVE',
    specs: { Capacity: '40 L', 'Laptop sleeve': 'Up to 15.6 inch', Material: 'Water-resistant ripstop nylon', Weight: '1.4kg' },
    images: [
      commons('Tropical_Rucksack_1.JPG', 'Travel backpack'),
      commons('Backpacks_from_the_Habagat_Outdoor_Equipment_(2023-09-03).jpg', 'Travel backpacks on display'),
    ],
    variants: [{ sku: 'EVD-BAG-BP40', attributes: { Color: 'Olive' }, stockQty: 20 }],
  },
  {
    slug: 'insulated-water-bottle',
    name: 'Everyday Insulated Water Bottle, 750ml',
    description: 'A double-wall stainless steel bottle that keeps drinks cold for 24 hours or hot for 12.',
    category: 'travel',
    brand: 'everyday',
    basePrice: '999.00',
    status: 'ACTIVE',
    specs: {
      Capacity: '750 ml',
      Material: '18/8 stainless steel, double-wall vacuum insulated',
      'Keeps cold': '24 hours',
      'Keeps hot': '12 hours',
    },
    images: [commons('Stainless_steel_water_bottle.jpg', 'Insulated stainless steel water bottle'), commons('Metal_Water_Bottles.jpeg', 'Metal water bottles')],
    variants: [{ sku: 'EVD-BTL-750', attributes: { Color: 'Steel' }, stockQty: 55 }],
  },
  // Office
  {
    slug: 'led-desk-lamp',
    name: 'Everyday LED Desk Lamp',
    description: 'A dimmable LED desk lamp with adjustable color temperature and a flicker-free display.',
    category: 'office',
    brand: 'everyday',
    basePrice: '1599.00',
    status: 'ACTIVE',
    featured: true,
    specs: {
      'Light source': 'LED, flicker-free',
      'Brightness levels': '5 levels',
      'Color temperature': '3000K–6500K adjustable',
      Power: 'USB-powered',
    },
    images: [commons('A_desk_lamp.jpg', 'LED desk lamp'), commons('Desk_lamp.jpg', 'Desk lamp on a table')],
    variants: [{ sku: 'EVD-LMP-LED', attributes: { Color: 'White' }, stockQty: 32, compareAtPrice: '1999.00' }],
  },
  {
    slug: 'notebook-planner-set',
    name: 'Everyday Notebook & Planner Set',
    description: 'A dot-grid notebook paired with an undated weekly planner, bound in a durable hardcover.',
    category: 'office',
    brand: 'everyday',
    basePrice: '799.00',
    status: 'ACTIVE',
    specs: { Pages: '192 dot-grid + 96 planner', 'Paper weight': '100gsm', Cover: 'Hardcover, elastic closure' },
    images: [commons('Notebook.jpg', 'Notebook, closed'), commons('Pen_on_a_notebook_(Unsplash).jpg', 'Pen resting on an open notebook')],
    variants: [{ sku: 'EVD-NB-SET', attributes: {}, stockQty: 70 }],
  },
  {
    slug: 'standing-desk-converter',
    name: 'Everyday Standing Desk Converter',
    description: 'A height-adjustable desktop riser that sits on your existing desk, for switching between sitting and standing.',
    category: 'office',
    brand: 'everyday',
    basePrice: '7999.00',
    status: 'ACTIVE',
    specs: { 'Height range': '15cm – 50cm', 'Surface size': '80cm x 60cm', 'Weight capacity': '15kg', Adjustment: 'Gas-spring, one-hand' },
    images: [
      commons('Standing_Desk_by_Amrish_Kawa_06.jpg', 'Standing desk converter on an office desk'),
      commons('Sit-stand_desk.png', 'Illustration of a sit-stand desk converter'),
    ],
    variants: [{ sku: 'EVD-DSK-STAND', attributes: {}, stockQty: 9, compareAtPrice: '9499.00' }],
  },
  // Lifestyle
  {
    slug: 'leather-wallet',
    name: 'Everyday Leather Wallet',
    description: 'A slim bifold wallet in genuine leather with six card slots and a cash pocket.',
    category: 'lifestyle',
    brand: 'everyday',
    basePrice: '1299.00',
    status: 'ACTIVE',
    specs: { Material: 'Genuine leather', 'Card slots': '6', Closure: 'Bifold' },
    images: [
      commons('Aarong_leather_wallet.jpg', 'Leather bifold wallet'),
      commons('An_old_wallet_with_brown_color.jpg', 'Leather bifold wallet, open view'),
    ],
    variants: [
      { sku: 'EVD-WLT-BRN', attributes: { Color: 'Brown' }, stockQty: 25 },
      { sku: 'EVD-WLT-BLK', attributes: { Color: 'Black' }, stockQty: 18 },
    ],
  },
  {
    slug: 'scented-candle',
    name: 'Everyday Scented Candle',
    description: 'A hand-poured soy wax candle with a 45-hour burn time, housed in a reusable glass jar.',
    category: 'lifestyle',
    brand: 'everyday',
    basePrice: '699.00',
    status: 'ACTIVE',
    featured: true,
    specs: { Wax: 'Soy wax blend', 'Burn time': 'Up to 45 hours', Jar: 'Reusable glass', Wick: 'Cotton' },
    images: [commons('Candle_in_candle_holder_(Unsplash).jpg', 'Scented candle burning'), commons('Scented_candle.png', 'Scented candle in a glass jar')],
    variants: [{ sku: 'EVD-CDL-SOY', attributes: { Scent: 'Sandalwood' }, stockQty: 60 }],
  },
  {
    slug: 'ceramic-mug-set',
    name: 'Everyday Ceramic Mug Set',
    description: 'A set of two stoneware mugs with a matte glaze finish, microwave and dishwasher safe.',
    category: 'lifestyle',
    brand: 'everyday',
    basePrice: '899.00',
    status: 'ACTIVE',
    specs: { 'Set size': '2 mugs', Capacity: '350ml each', Material: 'Stoneware ceramic', Care: 'Microwave and dishwasher safe' },
    images: [commons('Cup188_(15644314231).jpg', 'Ceramic mug'), commons('Cup222_(15623287766).jpg', 'Ceramic mug, second piece')],
    variants: [{ sku: 'EVD-MUG-SET2', attributes: {}, stockQty: 40 }],
  },
  {
    slug: 'canvas-tote-bag',
    name: 'Everyday Canvas Tote Bag',
    description: 'A durable cotton canvas tote with reinforced handles, sized for daily errands and market trips.',
    category: 'lifestyle',
    brand: 'everyday',
    basePrice: '599.00',
    status: 'ACTIVE',
    specs: { Material: '12oz cotton canvas', Capacity: '18 L', Handles: 'Reinforced stitched' },
    images: [commons('Reusable_Bag.jpg', 'Canvas tote bag'), commons('Tote_bag_blacu_tas_blacu.jpg', 'Canvas tote bag, folded')],
    variants: [{ sku: 'EVD-TOTE-CVS', attributes: { Color: 'Natural' }, stockQty: 65 }],
  },
];

const PRODUCTS: ProductSpec[] = [...AUDIO_PRODUCTS, ...MARKETPLACE_PRODUCTS];

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

function picsumImageUrl(slug: string, n: number) {
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
    specs: (spec.specs ?? {}) as Prisma.InputJsonValue,
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
      compareAtPrice: variant.compareAtPrice ?? null,
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
  const images = spec.images ?? [1, 2].map((n) => ({ url: picsumImageUrl(spec.slug, n), altText: `${spec.name}, view ${n}` }));
  await prisma.productImage.createMany({
    data: images.map((image, index) => ({
      productId: product.id,
      url: image.url,
      altText: image.altText,
      position: index,
    })),
  });

  return product.id;
}

const REVIEWERS = [
  'Priya Sharma',
  'Arjun Mehta',
  'Kavya Iyer',
  'Rohan Gupta',
  'Ananya Nair',
  'Vikram Rao',
  'Sneha Kulkarni',
  'Aditya Verma',
] as const;

const REVIEW_BODIES: Record<number, string[]> = {
  5: [
    'Exceeded my expectations — worth every rupee.',
    'Exactly as described, arrived well packaged, and works perfectly.',
    'This has quickly become part of my daily routine. Highly recommend.',
    'Great build quality for the price. Would buy again.',
    'Fast delivery and the product feels premium in hand.',
    'Does exactly what it promises. No complaints at all.',
    'Been using this for a few weeks now and it is holding up great.',
    'Perfect gift — the packaging alone impressed the recipient.',
  ],
  4: [
    'Solid product overall, though the instructions could be clearer.',
    'Good value for money. One minor gripe but nothing dealbreaking.',
    'Works well, took a few days to get used to it.',
    'Happy with the purchase, delivery took a bit longer than expected.',
    'Does the job nicely. Would consider a different color next time.',
  ],
  3: [
    'It is fine, but I expected a bit more given the price.',
    'Average experience — works, but nothing special.',
    'Decent, though I have seen similar products with better finishing.',
  ],
};

const RATING_CYCLE = [5, 5, 5, 4, 4, 3] as const;

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministically assigns 3-6 reviews per product from a fixed reviewer/body
 * pool, so ratingAvg/reviewCount are always the true aggregate of real seeded
 * rows rather than arbitrary numbers.
 */
async function seedReviews(prisma: PrismaClient, reviewerIds: string[], productId: string, slug: string) {
  const hash = hashSlug(slug);
  const count = 3 + (hash % 4);
  const ratings: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const rating = RATING_CYCLE[(hash + i) % RATING_CYCLE.length];
    ratings.push(rating);
    const bodies = REVIEW_BODIES[rating];
    const body = bodies[(hash + i * 7) % bodies.length];
    const userId = reviewerIds[(hash + i) % reviewerIds.length];
    const createdAt = new Date(Date.now() - (i * 13 + (hash % 30)) * 86_400_000);
    await prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      update: { rating, body, status: 'APPROVED', createdAt },
      create: { productId, userId, rating, body, status: 'APPROVED', createdAt },
    });
  }
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round(avg * 10) / 10, reviewCount: ratings.length },
  });
}

export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const audio = await upsertCategory(prisma, 'audio', 'Audio');
  const headphones = await upsertCategory(prisma, 'headphones', 'Headphones', audio.id);
  const homeAudio = await upsertCategory(prisma, 'home-audio', 'Home audio', audio.id);
  const accessories = await upsertCategory(prisma, 'accessories', 'Accessories', audio.id);
  const overEar = await upsertCategory(prisma, 'over-ear', 'Over-ear', headphones.id);
  const inEar = await upsertCategory(prisma, 'in-ear', 'In-ear', headphones.id);
  const dacs = await upsertCategory(prisma, 'dacs', 'DACs', homeAudio.id);
  const amplifiers = await upsertCategory(prisma, 'amplifiers', 'Amplifiers', homeAudio.id);
  const cables = await upsertCategory(prisma, 'cables', 'Cables', accessories.id);

  const electronics = await upsertCategory(prisma, 'electronics', 'Electronics');
  const computers = await upsertCategory(prisma, 'computers', 'Computers & Accessories');
  const homeKitchen = await upsertCategory(prisma, 'home-kitchen', 'Home & Kitchen');
  const fitness = await upsertCategory(prisma, 'fitness', 'Fitness');
  const travel = await upsertCategory(prisma, 'travel', 'Travel');
  const office = await upsertCategory(prisma, 'office', 'Office');
  const lifestyle = await upsertCategory(prisma, 'lifestyle', 'Lifestyle');

  const categories: Record<string, { id: string }> = {
    headphones,
    'home-audio': homeAudio,
    accessories,
    audio,
    'over-ear': overEar,
    'in-ear': inEar,
    dacs,
    amplifiers,
    cables,
    electronics,
    computers,
    'home-kitchen': homeKitchen,
    fitness,
    travel,
    office,
    lifestyle,
  };

  const [aurelia, sable, northwind, helix, everyday] = await Promise.all([
    upsertBrand(prisma, 'aurelia', 'Aurelia'),
    upsertBrand(prisma, 'sable', 'Sable'),
    upsertBrand(prisma, 'northwind', 'Northwind'),
    upsertBrand(prisma, 'helix', 'Helix'),
    upsertBrand(prisma, 'everyday', 'Everyday'),
  ]);
  const brands: Record<string, { id: string }> = { aurelia, sable, northwind, helix, everyday };

  const reviewerPassword = await bcrypt.hash('ChangeMe!Dev123', 12);
  const reviewerIds: string[] = [];
  for (const [index, name] of REVIEWERS.entries()) {
    const email = `reviewer${index + 1}@audiocommerce.demo`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name, passwordHash: reviewerPassword, role: 'CUSTOMER' },
    });
    reviewerIds.push(user.id);
  }

  const productIds: { id: string; slug: string }[] = [];
  for (const spec of PRODUCTS) {
    const category = categories[spec.category];
    const brand = brands[spec.brand];
    if (!category || !brand) throw new Error(`Unknown category or brand for ${spec.slug}`);
    const id = await upsertProduct(prisma, spec, category.id, brand.id);
    productIds.push({ id, slug: spec.slug });
  }

  for (const { id, slug } of productIds) {
    const spec = PRODUCTS.find((p) => p.slug === slug);
    if (spec?.status !== 'ACTIVE') continue;
    await seedReviews(prisma, reviewerIds, id, slug);
  }

  await prisma.contentBlock.deleteMany();
  await prisma.contentBlock.createMany({
    data: [
      {
        type: 'BANNER',
        position: 0,
        active: true,
        payload: {
          title: 'Everyday essentials, done right',
          subtitle: 'Electronics, home, fitness, travel, and office goods — chosen for quality, not hype.',
          ctaLabel: 'Browse the shop',
          ctaHref: '/products',
        },
      },
      {
        type: 'ANNOUNCEMENT',
        position: 1,
        active: true,
        payload: {
          message: 'Free shipping on orders over ₹999 — easy 7-day returns on everything.',
          href: '/products',
        },
      },
      {
        type: 'FEATURED_COLLECTION',
        position: 2,
        active: true,
        payload: {
          title: 'Staff picks',
          productSlugs: ['aurelia-nova', 'sable-ion', 'air-fryer', 'mechanical-keyboard', 'hardshell-carry-on-suitcase'],
        },
      },
    ],
  });

  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: {
      storeName: 'Everyday',
      contactEmail: 'hello@everyday.demo',
      heroContent: HERO,
    },
    create: {
      id: 'singleton',
      storeName: 'Everyday',
      contactEmail: 'hello@everyday.demo',
      heroContent: HERO,
    },
  });
}
