import { z } from 'zod';
import { BoxOutputs, BoxBase, BoxSchemaBaseZ, BoxManager } from '../common/base.js';
import { PaperspaceClient } from '../../lib/paperspace/PaperspaceClient.js';
import * as fs from "fs"
import { MachinesList200ResponseItemsInner } from '../../lib/paperspace/generated-api/api.js';

export const BOX_KIND_PAPERSPACE_MACHINE = "paperspace.Machine.Manager"

/**
 * Paperspace API requires a template ID to create machines.
 * Default to using Ubuntu22.
 * 
 * It's not documented officially (yet) but using API one can get all templates:
 * 
 * https://api.paperspace.io/templates/getTemplates x-api-key: xxx
*/
export const DEFAULT_MACHINE_TEMPLATE_ID = "t0nspur5" // Ubuntu 22

export const PaperspaceBoxManagerSpecZ = z.object({
    apiKeyFile: z.string(),
    machineType: z.string(),
    region: z.string(),
});

export const PaperspaceBoxManagerSchemaZ = BoxSchemaBaseZ.extend({
    spec: PaperspaceBoxManagerSpecZ
})

export type PaperspaceBoxManagerSpec = z.infer<typeof PaperspaceBoxManagerSpecZ>;

export class PaperspaceBoxManager extends BoxBase implements BoxManager  {

    private client: PaperspaceClient;
    private spec: PaperspaceBoxManagerSpec;

    static async parseSpec(source: unknown) : Promise<PaperspaceBoxManager> {
        const config = PaperspaceBoxManagerSchemaZ.parse(source)
        return new PaperspaceBoxManager(config.name, config.spec)
    }

    constructor(name: string, spec: PaperspaceBoxManagerSpec) {
        super({ kind: BOX_KIND_PAPERSPACE_MACHINE, name: name })
        this.spec = spec;
        this.client = new PaperspaceClient(fs.readFileSync(spec.apiKeyFile, { encoding: 'utf8' }));
    }

    async deploy(): Promise<BoxOutputs> {
        await this.provision()
        return this.configure()
    }

    async configure(): Promise<BoxOutputs> {
        this.logger.debug("Paperspace configuration is no op.")
        return this.get()
    }

    async provision(): Promise<BoxOutputs> {
        const machine = await this.client.createMachine({
            name: this.getMachineName(),
            machineType: this.spec.machineType,
            region: this.spec.region || "Europe (AMS1)",
            templateId: DEFAULT_MACHINE_TEMPLATE_ID,
            diskSize: 50,
        });
        return { machineId: machine.id, publicIp: machine.publicIp };
    }

    async destroy(): Promise<void> {
        const m = await this.get()
        this.logger.info(`Destroying machine ${m.id}`)
        await this.client.deleteMachine(m.id);
    }

    async preview(): Promise<string> {
        return `This will provision a Paperspace machine in ${this.spec.region} with type ${this.spec.machineType}.`;
    }

    private getMachineName() : string{
        return this.metadata.name
    }

    private async getMachineId() : Promise<string>{
        const m = await this.get()
        return m.id
    }

    async get(): Promise<MachinesList200ResponseItemsInner> {
        const machine = await this.client.getMachineByName(this.getMachineName())
        return machine
    }

    async stop(): Promise<void> {
        await this.client.stopMachine(await this.getMachineId())
    }
    
    async start(): Promise<void> {
        await this.client.startMachine(await this.getMachineId())
    }
    
    async restart(): Promise<void> {
        await this.client.restartMachine(await this.getMachineId())
    }

}
