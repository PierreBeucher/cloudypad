import { input, select } from '@inquirer/prompts'
import {  StaticInitializerPrompts, InstanceInitArgs, AbstractInstanceInitializer } from '../../core/initializer'
import { CommonProvisionInputV1 } from '../../core/state/state'
import { GcpClient } from '../../tools/gcp'
import { GcpProvisionInputV1 } from './state'
import { CLOUDYPAD_PROVIDER_GCP } from '../../core/const'

export type GcpInstanceInitArgs = InstanceInitArgs<GcpProvisionInputV1>

export class GcpInstanceInitializer extends AbstractInstanceInitializer<GcpProvisionInputV1> {

    constructor(args: GcpInstanceInitArgs){
        super(CLOUDYPAD_PROVIDER_GCP, args)
    }

    async promptProviderConfig(commonInput: CommonProvisionInputV1): Promise<GcpProvisionInputV1> {

        const projectId = await this.project(this.args.input.projectId)
        
        const client = new GcpClient(GcpInstanceInitializer.name, projectId)

        const region = await this.region(client, this.args.input.region)
        const zone = await this.zone(client, region, this.args.input.zone)
        const machineType = await this.machineType(client, zone, this.args.input.machineType)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(this.args.input.useSpot)
        const diskSize = await this.diskSize(this.args.input.diskSize)
        const publicIpType = await StaticInitializerPrompts.publicIpType(this.args.input.publicIpType)
        const acceleratorType = await this.acceleratorType(client, zone, this.args.input.acceleratorType)
        
        const gcpConf: GcpProvisionInputV1 = {
            ...commonInput,
            projectId: projectId,
            diskSize: diskSize,
            machineType: machineType,
            publicIpType: publicIpType,
            region: region,
            zone: zone,
            acceleratorType: acceleratorType,
            useSpot: useSpot,
        }

        return gcpConf
    }

    private async machineType(client: GcpClient, zone: string, machineType?: string): Promise<string> {
        if (machineType) {
            return machineType
        }

        const machineTypes = await client.listMachineTypes(zone)

        const choices = machineTypes
            .filter(t => t.name)
            .filter(t => t.name && t.name.startsWith("n1") // Only show n1 with reasonable specs
                && t.guestCpus && t.guestCpus >= 2 && t.guestCpus <=16
                && t.memoryMb && t.memoryMb >= 1000 && t.memoryMb <= 100000
            ) 
            .sort((a, b) => { // Sort by CPU/RAM count
                if (a.guestCpus === b.guestCpus) {
                    return a.memoryMb! - b.memoryMb!; // Sort by memory if CPU count is the same
                }
                return a.guestCpus! - b.guestCpus!
            }) 
            .map(t => ({
                name: `${t.name} (RAM: ${Math.round(t.memoryMb! / 100)/10} GB, CPUs: ${t.guestCpus})`,
                value: t.name!,
            }))
        
        if(choices.length == 0){
            this.logger.warn("No suitable N1 machine type available in selected zone. It's recommended to use N1 instance type with Google Cloud. You can still choose your own instance type but setup may not behave as expected.")
        }

        choices.push({name: "Let me type a machine type", value: "_"})

        const selectedMachineType = await select({
            message: 'Choose a machine type:',
            choices: choices,
            loop: false,
        })

        if(selectedMachineType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedMachineType        
    }

    private async diskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize
        }

        const selectedDiskSize = await input({
            message: 'Enter desired disk size (GB):',
            default: "100"
        })

        return Number.parseInt(selectedDiskSize)

    }

    private async region(client: GcpClient, region?: string): Promise<string> {
        if (region) {
            return region
        }

        const regions = await client.listRegions()

        const selected = await select({
            message: 'Select region to use:',
            choices: regions
                .filter(r => r.name && r.id)
                .map(r => ({ name: `${r.name!} (${r.description})`, value: r.name!}))
        })

        return selected.toString()
    }

    private async zone(client: GcpClient, region: string, zone?: string): Promise<string> {
        if (zone) {
            return zone
        }
        
        const zones =  await client.listRegionZones(region)

        if(zones.length == 0){
            throw new Error(`No zones found in region ${region}`)
        }

        return await select({
            message: 'Select zone to use:',
            choices: zones.map(z => ({name: z, value: z})),
            default: zones[0]
        })
    }

    private async project(projectId?: string): Promise<string> {
        if (projectId) {
            return projectId
        }

        const projects = await GcpClient.listProjects()

        return await select({
            message: 'Select a project to use:',
            choices: projects
                .filter(p => p.projectId)
                .map(p => ({name: `${p.displayName} (${p.projectId})`, value: p.projectId!}))
        })
    }

    private async acceleratorType(client: GcpClient, zone: string, acceleratorType?: string): Promise<string> {
        if (acceleratorType) {
            return acceleratorType
        }

        const acceleratorTypes = await client.listAcceleratorTypes(zone)

        const choices = acceleratorTypes.filter(t => t.name)
            .filter(t => t.name && t.name.startsWith("nvidia") && !t.name.includes("vws")) // only support NVIDIA for now and remove workstations
            .map(t => ({name: `${t.description} (${t.name})`, value: t.name!}))
            .sort()

        return await select({
            message: 'Select GPU type (accelerator type) to use:',
            choices: choices,
            loop: false
        })
    }
}