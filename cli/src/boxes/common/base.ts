import { z } from "zod"

export const BOX_SCHEMA_BASE = z.object({
    kind: z.string(),
    name: z.string()
})

export type BoxSchemaBase = z.infer<typeof BOX_SCHEMA_BASE>