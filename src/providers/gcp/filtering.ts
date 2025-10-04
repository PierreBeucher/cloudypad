import { MACHINE_TYPE_FAMILIES_GAMING } from './const';

/** Returns true if the machine type matches gaming criteria (family, CPU, RAM). */
export function isGamingMachineType(t: { name?: string | null, guestCpus?: number | null, memoryMb?: number | null }): boolean {
  const isGamingType = t.name && MACHINE_TYPE_FAMILIES_GAMING.some(fam => t.name!.startsWith(fam));
  const enoughCpu = t.guestCpus != null && t.guestCpus >= 2 && t.guestCpus <= 16;
  const enoughRam = t.memoryMb != null && t.memoryMb >= 1000 && t.memoryMb <= 100000;
  return Boolean(isGamingType && enoughCpu && enoughRam);
}