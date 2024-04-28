import { z } from 'zod';
import { BaseBox, BoxConstructorMetadata, BoxSchemaBaseZ, MachineBoxProvisioner, MachineBoxProvisionerOutput } from '../common/base.js';
import { PaperspaceClient } from '../../lib/paperspace/PaperspaceClient.js';

export const BOX_KIND_PAPERSPACE_MACHINE = "paperspace.Machine.Manager"
export const BOX_CONTEXT_PAPERSPACE_MACHINE = "paperspace.Machine"

/**
 * Paperspace API requires a template ID to create machines.
 * Default to using Ubuntu22.
 * 
 * It's not documented officially (yet) but using API one can get all templates:
 * 
 * https://api.paperspace.io/templates/getTemplates x-api-key: xxx
*/
export const DEFAULT_MACHINE_TEMPLATE_ID = "t0nspur5" // Ubuntu 22

export const PaperspaceManagerBoxSpecZ = z.object({
    apiKeyFile: z.string().optional(),
    machineType: z.string(),
    region: z.string(),
});

export const PaperspaceManagerBoxSchemaZ = BoxSchemaBaseZ.extend({
    spec: PaperspaceManagerBoxSpecZ
})

export type PaperspaceManagerBoxSpec = z.infer<typeof PaperspaceManagerBoxSpecZ>;

export class PaperspaceManagerBox extends BaseBox implements MachineBoxProvisioner  {

    private client: PaperspaceClient;
    private spec: PaperspaceManagerBoxSpec;

    static async parseSpec(source: unknown) : Promise<PaperspaceManagerBox> {
        const config = PaperspaceManagerBoxSchemaZ.parse(source)
        return new PaperspaceManagerBox({ name: config.name, context: BOX_CONTEXT_PAPERSPACE_MACHINE}, config.spec)
    }

    constructor(meta: BoxConstructorMetadata, spec: PaperspaceManagerBoxSpec) {
        super({ name: meta.name, context: meta.context, kind: BOX_KIND_PAPERSPACE_MACHINE })
        this.spec = spec;
        this.client = new PaperspaceClient({ apiKeyFile: spec.apiKeyFile});
    }

    async deploy() {
        await this.provision()
        return this.configure()
    }

    async configure() {
        this.logger.debug("Paperspace configuration is no op.")
        return this.get()
    }

    async provision() {
        if (await this.client.machineWithNameExists(this.getMachineName())) {
            this.logger.info(`Found existing machine ${this.getMachineName()}. No creation needed.`)
            return this.get()
        }
        
        this.logger.info(`Creating machine ${this.getMachineName()}. No creation needed.`)
        const machine = await this.client.createMachine({
            name: this.getMachineName(),
            machineType: this.spec.machineType || "C2",
            region: this.spec.region || "Europe (AMS1)",
            templateId: DEFAULT_MACHINE_TEMPLATE_ID,
            diskSize: 50,
            startOnCreate: true,
            publicIpType: 'dynamic'
        });

        // Machine may not have an IP before being fully started
        await this.client.waitForMachineState(machine.id, 'ready')
        const startedMachine = await this.client.getMachine(machine.id)

        return { machineId: startedMachine.id, publicIp: startedMachine.publicIp };
    }

    async destroy() {
        const m = await this.getMachine()
        this.logger.info(`Destroying machine ${m.id}`)
        await this.client.deleteMachine(m.id);
    }

    public async refresh() {
        // Nothing to refresh for Paperspace hasit has no state
        return this.get
    }

    async preview() {
        return `Will provision a Paperspace machine in ${this.spec.region} with type ${this.spec.machineType}.`;
    }

    private getMachineName(): string{
        return this.metadata.name
    }

    private async getMachine() {
        return this.client.getMachineByName(this.getMachineName())
    }

    async get(): Promise<MachineBoxProvisionerOutput> {
        const machine = await this.client.getMachineByName(this.getMachineName())
        return { instances: [ {
            address: machine.publicIp || undefined,
            id: machine.id,
            name: machine.name
        } ] }
    }

    async stop(): Promise<void> {
        const m = await this.getMachine()
        await this.client.stopMachine(m.id)
    }
    
    async start(): Promise<void> {
        const m = await this.getMachine()
        await this.client.startMachine(m.id)
    }
    
    async restart(): Promise<void> {
        const m = await this.getMachine()
        await this.client.restartMachine(m.id)
    }

}
