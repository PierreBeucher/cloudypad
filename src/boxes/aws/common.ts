import { z } from 'zod';

export const InstanceSchema = z.object({
  ami: z.string(),
  type: z.string(),
  availabilityZone: z.string().optional(),
  staticIpEnable: z.boolean().optional(),
  rootVolume: z.object({
    sizeGb: z.number().optional(),
    type: z.string().optional(),
    encrypted: z.boolean().optional(),
  }).optional(),
});

export const VolumeSchema = z.object({
  size: z.number(),
  type: z.string().optional(),
  deviceName: z.string(),
  encrypted: z.boolean().optional(),
  availabilityZone: z.string().optional(),
  iops: z.number().optional(),
  throughput: z.number().optional(),
});

export const DnsSchema = z.object({
  zoneName: z.string().optional(),
  zoneId: z.string().optional(),
  prefix: z.string().optional(),
  ttl: z.number().optional(),
  type: z.string().optional(),
});

export const PortDefinitionSchema = z.object({
  from: z.number(),
  to: z.number().optional(),
  protocol: z.string().optional(),
  cidrBlocks: z.array(z.string()).optional(),
  ipv6CirdBlocks: z.array(z.string()).optional()
})

export const NetworkSchema = z.object({
  vpcId: z.string().optional(),
  subnetId: z.string().optional(),
  ingressPorts: z.array(PortDefinitionSchema).optional(),
}).optional();

export const TagsSchema = z.record(z.string())

