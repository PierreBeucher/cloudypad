import { GcpInstanceInput, GcpInstanceStateV1, GcpProvisionInputV1, GcpProvisionInputV1Schema } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions } from "../../cli/prompter";
import { GcpClient } from "./sdk-client";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_VARIANT, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS } from "../../cli/command";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { GcpProviderClient } from "./provider";
import { z } from "zod";

// ---------- Typed helpers (no .unwrap(), no any) ----------

/**
 * Type guard: returns true if `x` is a ZodEnum<[string, ...string[]]>.
 * Using `instanceof z.ZodEnum` avoids any/unknown and lets TS narrow types safely.
 */
function isZodEnum(x: unknown): x is z.ZodEnum<[string, ...string[]]> {
  return x instanceof z.ZodEnum;
}

/**
 * Type guard: returns true if `x` is a ZodDefault wrapping a ZodEnum.
 * Some schemas are declared as z.enum([...]).default(...), i.e. ZodDefault<ZodEnum>.
 * We detect that case and later read the inner enum via `_def.innerType`.
 * Note: we purposely use ZodTypeAny (not unknown) to satisfy TS generic constraints.
 */
function isZodDefaultEnum(x: unknown): x is z.ZodDefault<z.ZodEnum<[string, ...string[]]>> {
  return x instanceof z.ZodDefault
    && ((x as z.ZodDefault<z.ZodTypeAny>)._def?.innerType instanceof z.ZodEnum);
}

/**
 * Return the enum literal values from either:
 *  - a plain ZodEnum, or
 *  - a ZodDefault<ZodEnum> (by reading its inner enum).
 *
 * We avoid `.unwrap()` because some Zod versions don’t expose it on ZodDefault.
 * This function gives us a fully-typed readonly tuple of allowed string literals.
 */
function enumOptions<T extends z.ZodEnum<[string, ...string[]]>>(
  schema: T | z.ZodDefault<T>
): Readonly<T["_def"]["values"]> {
  if (isZodEnum(schema)) {
    return schema.options as Readonly<T["_def"]["values"]>;
  }
  if (isZodDefaultEnum(schema)) {
    // Access the inner enum safely and return its options (literal tuple)
    const inner = (schema as z.ZodDefault<T>)._def.innerType as T;
    return inner.options as Readonly<T["_def"]["values"]>;
  }
  // Defensive: enforce correct schema shape at call sites
  throw new Error("Field is not a ZodEnum or ZodDefault<ZodEnum>.");
}

/**
 * Narrow a loose `string | undefined` to the exact union of literals defined by the schema.
 * - If `value` is missing or not part of the enum, return `undefined`.
 * - If it matches one of the literals, return it as the precise union type (e.g. "pd-ssd").
 *
 * This removes TS2322 errors when assigning CLI strings to literal-union fields.
 */
function toEnumFromSchema<T extends z.ZodEnum<[string, ...string[]]>>(
  schema: T | z.ZodDefault<T>,
  value?: string
): T["_def"]["values"][number] | undefined {
  if (!value) return undefined;
  const opts = enumOptions(schema) as readonly string[];
  return opts.includes(value) ? (value as T["_def"]["values"][number]) : undefined;
}

/**
 * Strict variant of `toEnumFromSchema`:
 * - Returns a valid literal (never undefined), or
 * - Throws an error listing allowed values.
 *
 * Use this when the value MUST be present and valid (e.g., after interactive prompts
 * that always provide a default), to satisfy schemas where the field is non-optional.
 */
function toEnumFromSchemaOrThrow<T extends z.ZodEnum<[string, ...string[]]>>(
  schema: T | z.ZodDefault<T>,
  value: string
): T["_def"]["values"][number] {
  const v = toEnumFromSchema(schema, value);
  if (v === undefined) {
    const opts = Array.from(enumOptions(schema)).join(", ");
    throw new Error(`Invalid value "${value}". Allowed: ${opts}`);
  }
  return v;
}



export interface GcpCreateCliArgs extends CreateCliArgs {
  projectId?: string
  region?: string
  zone?: string
  machineType?: string
  diskSize?: number
  diskType?: string
  networkTier?: string
  nicType?: string
  publicIpType?: PUBLIC_IP_TYPE
  gpuType?: string
  spot?: boolean,
  costAlert?: boolean
  costLimit?: number
  costNotificationEmail?: string
}

/** Possible update arguments for GCP update. */
export type GcpUpdateCliArgs = UpdateCliArgs & Omit<GcpCreateCliArgs, "projectId" | "region" | "zone">

export class GcpInputPrompter extends AbstractInputPrompter<GcpCreateCliArgs, GcpProvisionInputV1, CommonConfigurationInputV1> {

  /** Build the initial partial input from CLI args (strings are narrowed to enum literal unions). */
  protected buildProvisionerInputFromCliArgs(cliArgs: GcpCreateCliArgs): PartialDeep<GcpInstanceInput> {
    return {
      provision: {
        machineType: cliArgs.machineType,
        diskSize: cliArgs.diskSize,
        diskType: toEnumFromSchema(GcpProvisionInputV1Schema.shape.diskType, cliArgs.diskType),
        networkTier: toEnumFromSchema(GcpProvisionInputV1Schema.shape.networkTier, cliArgs.networkTier),
        nicType: toEnumFromSchema(GcpProvisionInputV1Schema.shape.nicType, cliArgs.nicType),
        publicIpType: cliArgs.publicIpType,
        region: cliArgs.region,
        zone: cliArgs.zone,
        acceleratorType: cliArgs.gpuType,
        projectId: cliArgs.projectId,
        useSpot: cliArgs.spot,
        costAlert: costAlertCliArgsIntoConfig(cliArgs),
      },
    }
  }

  /** Ask all provider-specific params and return a fully typed GcpInstanceInput. */
  protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<GcpInstanceInput>, createOptions: PromptOptions): Promise<GcpInstanceInput> {
    if (!createOptions.autoApprove && !createOptions.skipQuotaWarning) {
      await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_GCP, "https://docs.cloudypad.gg/cloud-provider-setup/gcp.html")
    }

    const projectId = await this.project(partialInput.provision?.projectId)
    const client = new GcpClient(GcpInputPrompter.name, projectId)
    const region = await this.region(client, partialInput.provision?.region)
    const zone = await this.zone(client, region, partialInput.provision?.zone)
    const machineType = await this.machineType(client, zone, partialInput.provision?.machineType)
    const acceleratorType = await this.acceleratorType(client, zone, partialInput.provision?.acceleratorType)
    const useSpot = await this.useSpotInstance(partialInput.provision?.useSpot)
    const diskSize = await this.diskSize(partialInput.provision?.diskSize)
    const diskTypeRaw = await this.diskType(partialInput.provision?.diskType, client, zone)
    const networkTierRaw = await this.networkTier(partialInput.provision?.networkTier)
    const nicTypeRaw = await this.nicType(partialInput.provision?.nicType)
    const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
    const costAlert = await this.costAlert(partialInput.provision?.costAlert)

    // Narrow prompt strings to enum literal unions before merging (avoid widening by merge).
    const diskType = toEnumFromSchemaOrThrow(GcpProvisionInputV1Schema.shape.diskType, diskTypeRaw)
    const networkTier = toEnumFromSchemaOrThrow(GcpProvisionInputV1Schema.shape.networkTier, networkTierRaw)
    const nicType = toEnumFromSchemaOrThrow(GcpProvisionInputV1Schema.shape.nicType, nicTypeRaw)

    // Merge into final input (lodash.merge is fine here since we already narrowed the literals).
    const gcpInput: GcpInstanceInput = lodash.merge(
      {},
      commonInput,
      {
        provision: {
          projectId,
          diskSize,
          diskType,
          networkTier,
          nicType,
          machineType,
          publicIpType,
          region,
          zone,
          acceleratorType,
          useSpot,
          costAlert,
        },
      }
    )
    return gcpInput
  }

  /** Prompt for disk type using intersection of schema enum and available API values. */
  private async diskType(diskType?: string, client?: GcpClient, zone?: string): Promise<string> {
    if (!client || !zone) throw new Error("diskType prompt requires GcpClient and zone.");
    const diskTypeEnum = enumOptions(GcpProvisionInputV1Schema.shape.diskType);

    const DiskTypeDescriptions: Record<string, string> = {
      'pd-standard': 'Standard (cheapest, slowest)',
      'pd-balanced': 'Balanced (good compromise)',
      'pd-ssd': 'SSD (best performance, highest cost)',
    };

    let availableDiskTypes: string[] = [];
    try {
      availableDiskTypes = await client.listDiskTypes(zone);
    } catch (e) {
      console.warn(`Failed to fetch disk types from GCP API for zone ${zone}:`, e);
      availableDiskTypes = Array.from(diskTypeEnum);
    }

    const allowed = new Set<string>(diskTypeEnum as readonly string[]);
    const filtered = availableDiskTypes.filter((v: string) => allowed.has(v));

    const choices = filtered.map((v: string) => {
      const desc = DiskTypeDescriptions[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });
    if (choices.length === 0) {
      throw new Error(`No supported disk types available in zone ${zone}.`);
    }

    return await select({
      message: 'Select disk type (affects performance & price):',
      choices,
      default: filtered.includes('pd-balanced') ? 'pd-balanced' : choices[0].value,
    });
  }

  /** Prompt for network tier with simple explanations. */
  private async networkTier(networkTier?: string): Promise<string> {
    if (networkTier) return networkTier;
    const networkTierEnum = enumOptions(GcpProvisionInputV1Schema.shape.networkTier);
    const NetworkTierDescriptions: Record<string, string> = {
      'STANDARD': 'Standard (higher latency, cheaper)',
      'PREMIUM': 'Premium (lower latency, more expensive)',
    };
    const choices = Array.from(networkTierEnum).map((v: string) => {
      const desc = NetworkTierDescriptions[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });
    return await select({
      message: 'Select network tier (affects latency & price):',
      choices,
      default: 'STANDARD',
    });
  }

  /** Prompt for NIC type with simple explanations. */
  private async nicType(nicType?: string): Promise<string> {
    if (nicType) return nicType;
    const nicTypeEnum = enumOptions(GcpProvisionInputV1Schema.shape.nicType);
    const NicTypeDescriptions: Record<string, string> = {
      'auto': 'Auto (let GCP choose, recommended)',
      'GVNIC': 'GVNIC (high throughput / low latency, supported on some VMs)',
      'VIRTIO_NET': 'Virtio Net (legacy, broad compatibility)',
    };
    const choices = Array.from(nicTypeEnum).map((v: string) => {
      const desc = NicTypeDescriptions[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });
    return await select({
      message: 'Select NIC type (affects network performance):',
      choices,
      default: 'auto',
    });
  }

  private async machineType(client: GcpClient, zone: string, machineType?: string): Promise<string> {
    if (machineType) return machineType;

    const machineTypes = await client.listMachineTypes(zone)

    // Include n1 and g2, and filter for specs suitable for gaming
    const gamingMachineTypes = machineTypes
      .filter(t => t.name)
      .filter(t => {
        const isGamingType = t.name && (t.name.startsWith("n1") || t.name.startsWith("g2"));
        // Gaming criteria: at least 4 CPUs, 15+ GiB RAM, max 128 CPUs, max 512 GiB RAM
        const enoughCpu = t.guestCpus && t.guestCpus >= 4 && t.guestCpus <= 128;
        const enoughRam = t.memoryMb && t.memoryMb >= 15000 && t.memoryMb <= 524288;
        return isGamingType && enoughCpu && enoughRam;
      })
      .sort((a, b) => {
        if (a.guestCpus === b.guestCpus) {
          return a.memoryMb! - b.memoryMb!;
        }
        return a.guestCpus! - b.guestCpus!;
      })
      .map(t => ({
        name: `${t.name} (CPUs: ${t.guestCpus}, RAM: ${Math.round(t.memoryMb! / 100) / 10} GiB)`,
        value: t.name!,
      }));

    if (gamingMachineTypes.length === 0) {
      this.logger.warn("No suitable N1 or G2 machine type available in selected zone. You can still choose your own instance type but setup may not behave as expected.")
    }

    gamingMachineTypes.push({ name: "Let me type a machine type", value: "_" })

    const selectedMachineType = await select({
      message: 'Choose a machine type:',
      choices: gamingMachineTypes,
      loop: false,
    })

    if (selectedMachineType === '_') {
      return await input({ message: 'Enter machine type:' })
    }

    return selectedMachineType
  }

  private async diskSize(diskSize?: number): Promise<number> {
    if (diskSize) return diskSize;

    const selectedDiskSize = await input({
      message: 'Enter desired disk size (GB):',
      default: "100"
    })
    return Number.parseInt(selectedDiskSize)
  }

  private async region(client: GcpClient, region?: string): Promise<string> {
    if (region) return region;

    const regions = await client.listRegions()
    const selected = await select({
      message: 'Select region to use:',
      choices: regions
        .filter(r => r.name && r.id)
        .map(r => ({ name: `${r.name!} (${r.description})`, value: r.name! }))
    })
    return selected.toString()
  }

  private async zone(client: GcpClient, region: string, zone?: string): Promise<string> {
    if (zone) return zone;

    const zones = await client.listRegionZones(region)
    if (zones.length == 0) throw new Error(`No zones found in region ${region}`)

    return await select({
      message: 'Select zone to use:',
      choices: zones.map(z => ({ name: z, value: z })),
      default: zones[0]
    })
  }

  private async project(projectId?: string): Promise<string> {
    if (projectId) return projectId;

    const projects = await GcpClient.listProjects()
    return await select({
      message: 'Select a project to use:',
      choices: projects
        .filter(p => p.projectId)
        .map(p => ({ name: `${p.displayName} (${p.projectId})`, value: p.projectId! }))
    })
  }

  private async acceleratorType(client: GcpClient, zone: string, acceleratorType?: string): Promise<string> {
    if (acceleratorType) return acceleratorType;

    const acceleratorTypes = await client.listAcceleratorTypes(zone)

    const GpuDescriptions: Record<string, { label: string, type: string }> = {
      'nvidia-tesla-t4': { label: 'NVIDIA T4 (great for cloud gaming, 16GB VRAM)', type: 'T4' },
      'nvidia-l4': { label: 'NVIDIA L4 (new generation, 24GB VRAM, very performant for streaming)', type: 'L4' },
      'nvidia-a10g': { label: 'NVIDIA A10G (high-end, 24GB VRAM, advanced AI and gaming)', type: 'A10G' },
      'nvidia-p4': { label: 'NVIDIA P4 (entry-level, 8GB VRAM, sufficient for light games)', type: 'P4' },
      'nvidia-p100': { label: 'NVIDIA P100 (16GB VRAM, compute and advanced gaming)', type: 'P100' },
      'nvidia-v100': { label: 'NVIDIA V100 (16/32GB VRAM, very performant, overkill for gaming)', type: 'V100' },
    };

    const choices = acceleratorTypes.filter(t => t.name)
      .filter(t =>
        t.name && t.name.startsWith("nvidia") && !t.name.includes("vws") &&
        t.name != "nvidia-h100-80gb" && t.name != "nvidia-h100-mega-80gb"
      )
      .map(t => {
        const gpuInfo = GpuDescriptions[t.name!];
        const desc = gpuInfo ? `${gpuInfo.label} [Type: ${gpuInfo.type}]` : (t.description || t.name!);
        return { name: `${desc} (${t.name})`, value: t.name! };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return await select({
      message: 'Select GPU type (accelerator type) to use:',
      choices,
      loop: false
    })
  }
}

export class GcpCliCommandGenerator extends CliCommandGenerator {

  buildCreateCommand(args: BuildCreateCommandArgs) {
    return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_GCP)
      .addOption(CLI_OPTION_SPOT)
      .addOption(CLI_OPTION_DISK_SIZE)
      .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
      .addOption(CLI_OPTION_COST_ALERT)
      .addOption(CLI_OPTION_COST_LIMIT)
      .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
      .addOption(CLI_OPTION_STREAMING_SERVER)
      .addOption(CLI_OPTION_SUNSHINE_USERNAME)
      .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
      .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
      .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
      .addOption(CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS)
      .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
      .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
      .addOption(CLI_OPTION_USE_LOCALE)
      .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
      .addOption(CLI_OPTION_KEYBOARD_MODEL)
      .addOption(CLI_OPTION_KEYBOARD_VARIANT)
      .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
      .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
      .option('--machine-type <machinetype>', 'Machine type to use for the instance')
      .option('--region <region>', 'Region in which to deploy instance')
      .option('--zone <zone>', 'Zone within the region to deploy the instance')
      .option('--project-id <projectid>', 'GCP Project ID in which to deploy resources')
      .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
      .option('--disk-type <disktype>', 'Disk type to use (pd-standard, pd-balanced, pd-ssd)')
      .option('--network-tier <networktier>', 'Network tier to use (STANDARD, PREMIUM)')
      .option('--nic-type <nictype>', 'NIC type to use (auto, GVNIC, VIRTIO_NET)')
      .action(async (cliArgs: GcpCreateCliArgs) => {
        this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_GCP })
        try {
          await new InteractiveInstanceInitializer<GcpInstanceStateV1, GcpCreateCliArgs>({
            providerClient: new GcpProviderClient({ config: args.coreConfig }),
            inputPrompter: new GcpInputPrompter({ coreConfig: args.coreConfig }),
            initArgs: cliArgs
          }).initializeInteractive()

        } catch (error) {
          throw new Error('GCP instance initilization failed', { cause: error })
        }
      })
  }

  buildUpdateCommand(args: BuildUpdateCommandArgs) {
    return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_GCP)
      .addOption(CLI_OPTION_DISK_SIZE)
      .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
      .addOption(CLI_OPTION_COST_ALERT)
      .addOption(CLI_OPTION_COST_LIMIT)
      .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
      .addOption(CLI_OPTION_SUNSHINE_USERNAME)
      .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
      .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
      .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
      .addOption(CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS)
      .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
      .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
      .addOption(CLI_OPTION_USE_LOCALE)
      .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
      .addOption(CLI_OPTION_KEYBOARD_MODEL)
      .addOption(CLI_OPTION_KEYBOARD_VARIANT)
      .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
      .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
      .option('--machine-type <machinetype>', 'Machine type to use for the instance')
      .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
      .action(async (cliArgs: GcpUpdateCliArgs) => {
        this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_GCP })
        try {
          await new InteractiveInstanceUpdater<GcpInstanceStateV1, GcpUpdateCliArgs>({
            providerClient: new GcpProviderClient({ config: args.coreConfig }),
            inputPrompter: new GcpInputPrompter({ coreConfig: args.coreConfig }),
          }).updateInteractive(cliArgs)

          console.info(`Updated instance ${cliArgs.name}`)

        } catch (error) {
          throw new Error('GCP instance update failed', { cause: error })
        }
      })
  }
}
