// Machine families to show in the machine type prompt (gaming-oriented)
export const MACHINE_TYPE_FAMILIES_GAMING = ["n1", "g2"] as const;

// User-facing descriptions for GCP machine type families
export const MACHINE_TYPE_FAMILY_DESCRIPTIONS: Record<string, string> = {
  n1: 'N1: General purpose, good price/performance for most workloads (supports T4, P4, P100, V100 GPUs)',
  g2: 'G2: Newer generation, optimized for graphics and gaming (supports L4 GPU)',
  a2: 'A2: High performance, AI/ML workloads (supports A100 GPUs)',
  c3: 'C3: Compute-optimized, high CPU performance',
  c3d: 'C3D: Compute-optimized with local NVMe SSD',
  a3: 'A3: AI-optimized, very high performance',
  h3: 'H3: High memory, high performance',
};

// GPU descriptions for acceleratorType prompt
export const GPU_DESCRIPTIONS: Record<string, { label: string, type: string }> = {
  'nvidia-tesla-t4': { label: 'NVIDIA T4 (great for cloud gaming, 16GB VRAM)', type: 'T4' },
  'nvidia-l4': { label: 'NVIDIA L4 (new generation, 24GB VRAM, very performant for streaming)', type: 'L4' },
  'nvidia-a10g': { label: 'NVIDIA A10G (high-end, 24GB VRAM, advanced AI and gaming)', type: 'A10G' },
  'nvidia-p4': { label: 'NVIDIA P4 (entry-level, 8GB VRAM, sufficient for light games)', type: 'P4' },
  'nvidia-p100': { label: 'NVIDIA P100 (16GB VRAM, compute and advanced gaming)', type: 'P100' },
  'nvidia-v100': { label: 'NVIDIA V100 (16/32GB VRAM, very performant, overkill for gaming)', type: 'V100' },
  'nvidia-a100-40gb': { label: 'NVIDIA A100 40GB (AI/ML, compute, gaming)', type: 'A100-40GB' },
  'nvidia-a100-80gb': { label: 'NVIDIA A100 80GB (AI/ML, compute, gaming)', type: 'A100-80GB' },
};

// Families eligible for TIER_1 (egress bandwidth)
export const TIER1_FAMILIES = ["c3", "c3d", "a3", "h3"] as const;

// GCP machine type family → compatible acceleratorTypes (GPUs)
export const MACHINE_GPU_COMPAT: Record<string, string[]> = {
  n1: ['nvidia-tesla-t4'],
  g2: ['nvidia-l4'],
  a2: ['nvidia-a100-40gb', 'nvidia-a100-80gb'],
  // Add more families if needed
};

// Named constants for better readability
export const DISK_TYPE_STANDARD = 'pd-standard';
export const DISK_TYPE_BALANCED = 'pd-balanced';
export const DISK_TYPE_SSD = 'pd-ssd';

export const NETWORK_TIER_STANDARD = 'STANDARD';
export const NETWORK_TIER_PREMIUM = 'PREMIUM';

export const NIC_TYPE_AUTO = 'auto';
export const NIC_TYPE_GVNIC = 'GVNIC';
export const NIC_TYPE_VIRTIO_NET = 'VIRTIO_NET';

// Central GCP constants for allowed values
export const DISK_TYPES: string[] = [
  DISK_TYPE_STANDARD,
  DISK_TYPE_BALANCED,
  DISK_TYPE_SSD,
] as const;

export const NETWORK_TIERS: string[] = [
  NETWORK_TIER_STANDARD,
  NETWORK_TIER_PREMIUM,
] as const;

export const NIC_TYPES: string[] = [
  NIC_TYPE_AUTO,
  NIC_TYPE_GVNIC,
  NIC_TYPE_VIRTIO_NET,
] as const;

// Families eligible for TIER_1 (egress bandwidth) - using named constant
export const TIER1_NIC = NIC_TYPE_GVNIC;

export type DiskType = typeof DISK_TYPES[number];
export type NetworkTier = typeof NETWORK_TIERS[number];
export type NicType = typeof NIC_TYPES[number];

// Default values for prompts (explicit names)
export const DEFAULT_DISK_TYPE = DISK_TYPE_BALANCED;
export const DEFAULT_NETWORK_TIER = NETWORK_TIER_STANDARD;
export const DEFAULT_NIC_TYPE = NIC_TYPE_AUTO;

// User-facing descriptions for disk, network tier, and NIC types
export const DISK_TYPE_DESCRIPTIONS: Record<string, string> = {
  [DISK_TYPE_STANDARD]: 'Standard (cheapest, slowest)',
  [DISK_TYPE_BALANCED]: 'Balanced (good compromise)',
  [DISK_TYPE_SSD]: 'SSD (best performance, highest cost)',
};

export const NETWORK_TIER_DESCRIPTIONS: Record<string, string> = {
  [NETWORK_TIER_STANDARD]: 'Standard (higher latency, lower cost, includes 200 GiB/month free)',
  [NETWORK_TIER_PREMIUM]: 'Premium (lower latency, more expensive)',
};

export const NIC_TYPE_DESCRIPTIONS: Record<string, string> = {
  [NIC_TYPE_AUTO]: 'Auto (let GCP choose, recommended)',
  [NIC_TYPE_GVNIC]: 'GVNIC (high throughput / low latency, supported on some VMs)',
  [NIC_TYPE_VIRTIO_NET]: 'Virtio Net (legacy, broad compatibility)',
};

// Region prefix -> user-friendly label used in the continent/group prompt
// Note: Prefixes are derived from region names (e.g. "europe-west4" -> "europe-").
// If a prefix is not known here, the UI will show "<UNKNOWN>".
export const REGION_PREFIX_LABELS: Record<string, string> = {
  'europe-': 'Europe',
  'us-': 'United States / Canada',
  'asia-': 'Asia / Pacific',
  'southamerica-': 'South America',
  'me-': 'Middle East',
  'africa-': 'Africa',
  'australia-': 'Australia',
  'northamerica-': 'North America',
};

// Region name -> Country/Location label for display in region selection.
// Best-effort mapping based on public GCP region locations. Not exhaustive.
// If a region is not listed here, we won't display a country label for it.
export const REGION_COUNTRY_BY_REGION: Record<string, string> = {
  // Europe
  'europe-west1': 'Belgium',
  'europe-west2': 'London, United Kingdom',
  'europe-west3': 'Frankfurt, Germany',
  'europe-west4': 'Netherlands',
  'europe-west6': 'Zurich, Switzerland',
  'europe-west8': 'Milan, Italy',
  'europe-west9': 'Paris, France',
  'europe-west10': 'Berlin, Germany',
  'europe-west12': 'Turin, Italy',
  'europe-north1': 'Finland',
  'europe-central2': 'Warsaw, Poland',

  // North America
  'us-central1': 'Iowa, USA',
  'us-east1': 'South Carolina, USA',
  'us-east4': 'Northern Virginia, USA',
  'us-west1': 'Oregon, USA',
  'us-west2': 'Los Angeles, USA',
  'us-west3': 'Salt Lake City, USA',
  'us-west4': 'Las Vegas, USA',
  'northamerica-northeast1': 'Montréal, Canada',
  'northamerica-northeast2': 'Toronto, Canada',

  // Asia / Pacific
  'asia-east1': 'Taiwan',
  'asia-northeast1': 'Tokyo, Japan',
  'asia-northeast2': 'Osaka, Japan',
  'asia-northeast3': 'Seoul, South Korea',
  'asia-southeast1': 'Singapore',
  'asia-southeast2': 'Jakarta, Indonesia',
  'asia-south1': 'Mumbai, India',
  'asia-south2': 'Delhi, India',
  'asia-east2': 'Hong Kong',

  // Australia
  'australia-southeast1': 'Sydney, Australia',
  'australia-southeast2': 'Melbourne, Australia',

  // South America
  'southamerica-east1': 'São Paulo, Brazil',

  // Middle East
  'me-west1': 'Tel Aviv, Israel',
  'me-central1': 'Doha, Qatar',

  // Africa
  'africa-south1': 'Johannesburg, South Africa',
};
