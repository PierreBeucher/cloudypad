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
export const TIER1_NIC = "GVNIC";

// GCP machine type family → compatible acceleratorTypes (GPUs)
export const MACHINE_GPU_COMPAT: Record<string, string[]> = {
  n1: ['nvidia-tesla-t4'],
  g2: ['nvidia-l4'],
  a2: ['nvidia-a100-40gb', 'nvidia-a100-80gb'],
  // Add more families if needed
};

// Central GCP constants for allowed values
export const DISK_TYPES = [
  'pd-standard',
  'pd-balanced',
  'pd-ssd',
] as const;

export const NETWORK_TIERS = [
  'STANDARD',
  'PREMIUM',
] as const;

export const NIC_TYPES = [
  'auto',
  'GVNIC',
  'VIRTIO_NET',
] as const;

export type DiskType = typeof DISK_TYPES[number];
export type NetworkTier = typeof NETWORK_TIERS[number];
export type NicType = typeof NIC_TYPES[number];

// Default values for prompts (explicit names)
export const DEFAULT_DISK_TYPE = DISK_TYPES[1]; // 'pd-balanced'
export const DEFAULT_NETWORK_TIER = NETWORK_TIERS[0]; // 'STANDARD'
export const DEFAULT_NIC_TYPE = NIC_TYPES[0]; // 'auto'

// User-facing descriptions for disk, network tier, and NIC types
export const DISK_TYPE_DESCRIPTIONS: Record<string, string> = {
  [DISK_TYPES[0]]: 'Standard (cheapest, slowest)',
  [DISK_TYPES[1]]: 'Balanced (good compromise)',
  [DISK_TYPES[2]]: 'SSD (best performance, highest cost)',
};

export const NETWORK_TIER_DESCRIPTIONS: Record<string, string> = {
  [NETWORK_TIERS[0]]: 'Standard (higher latency, lower cost, includes 200 GiB/month free)',
  [NETWORK_TIERS[1]]: 'Premium (lower latency, more expensive)',
};

export const NIC_TYPE_DESCRIPTIONS: Record<string, string> = {
  [NIC_TYPES[0]]: 'Auto (let GCP choose, recommended)',
  [NIC_TYPES[1]]: 'GVNIC (high throughput / low latency, supported on some VMs)',
  [NIC_TYPES[2]]: 'Virtio Net (legacy, broad compatibility)',
};
