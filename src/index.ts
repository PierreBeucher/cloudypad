#! /usr/bin/env node

import { version } from '../package.json';
import { Command } from 'commander';
import { GlobalInstanceManager } from './core/manager';
import { setLogVerbosity } from './log/utils';
import { AwsProvisionArgs, AwsInstanceInitializer } from './providers/aws/initializer';
import { PartialDeep } from 'type-fest';
import { PaperspaceInstanceInitializer, PaperspaceProvisionArgs } from './providers/paperspace/initializer';
import * as fs from 'fs'
import { InstanceInitializationOptions } from './core/initializer';
import { AzureInstanceInitializer, AzureProvisionArgs } from './providers/azure/initializer';
import { GcpInstanceInitializer, GcpProvisionArgs } from './providers/gcp/initializer';

const program = new Command();

program
    .name('cloudypad')
    .description('Cloudy Pad CLI to manage your own gaming instance in the Cloud.')
    .option("--verbose, -v",
        "Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal). Alternatively, use CLOUDYPAD_LOG_LEVEL environment variable.", 
        (v) => { setLogVerbosity(Number.parseInt(v)) })
    .configureHelp({ showGlobalOptions: true})
    .version(version);

const createCmd = program
    .command('create')
    .description('Create a new instance, prompting for details. Use `create <provider> for provider-specific creation commands.`')
    .action(async (opts) => {
        try {
            const instanceInitializer = await GlobalInstanceManager.promptInstanceInitializer({
                instanceName: opts.name,
                sshKey: opts.privateSshKey,
            })

            // No default option for generic initializer
            instanceInitializer.initializeInstance({})

        } catch (error) {
            console.error('Error creating new instance:', error)
            process.exit(1)
        }
    })

createCmd
    .command('aws')
    .description('Create a new Cloudy Pad instance using AWS Cloud provider')
    .option('--name <name>', 'Instance name')
    .option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
    .option('--instance-type <type>', 'EC2 instance type')
    .option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', 'Public IP type. Either "static" or "dynamic"')
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const genericArgs = {
                instanceName: options.name,
                sshKey: options.privateSshKey,
            }

            const awsArgs: PartialDeep<AwsProvisionArgs> = {
                create: {
                    instanceType: options.instanceType,
                    diskSize: options.diskSize,
                    publicIpType: options.publicIpType,
                    region: options.region,
                    useSpot: options.spot,
                }
            }

            const opts: InstanceInitializationOptions = {
                autoApprove: options.yes,
                overwriteExisting: options.overwriteExisting
            }

            await new AwsInstanceInitializer(genericArgs, awsArgs).initializeInstance(opts)
            
        } catch (error) {
            console.error('Error creating AWS instance:', error)
            process.exit(1)
        }
    })

createCmd
    .command('paperspace')
    .description('Create a new Cloudy Pad instance using Paperspace Cloud provider')
    .option('--name <name>', 'Instance name')
    .option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
    .option('--api-key-file <apikeyfile>', 'Path to Paperspace API key file')
    .option('--machine-type <type>', 'Machine type')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', 'Public IP type. Either "static" or "dynamic"')
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const genericArgs = {
                instanceName: options.name,
                sshKey: options.privateSshKey,
            }

            const apiKey = options.apiKeyFile ? fs.readFileSync(options.apiKeyFile, 'utf-8') : undefined
            const pspaceArgs: PartialDeep<PaperspaceProvisionArgs> = {
                apiKey: apiKey,
                create: {
                    machineType: options.machineType,
                    diskSize: options.diskSize,
                    publicIpType: options.publicIpType,
                    region: options.region,
                }
            }

            const opts: InstanceInitializationOptions = {
                autoApprove: options.yes,
                overwriteExisting: options.overwriteExisting
            }
 
            await new PaperspaceInstanceInitializer(genericArgs, pspaceArgs).initializeInstance(opts)
            
        } catch (error) {
            console.error('Error creating Paperspace instance:', error)
            process.exit(1)
        }
    })

createCmd
    .command('gcp')
    .description('Create a new Cloudy Pad instance using Google Cloud provider')
    .option('--name <name>', 'Instance name')
    .option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
    .option('--machine-type <type>', 'Machine type')
    .option('--gpu-type <type>', 'GPU type (accelerator type)')
    .option('--project-id <project>', 'Project ID to use.')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', 'Public IP type. Either "static" or "dynamic"')
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--zone <zone>', 'Zone in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const genericArgs = {
                instanceName: options.name,
                sshKey: options.privateSshKey,
            }

            const gcpArgs: PartialDeep<GcpProvisionArgs> = {
                create: {
                    machineType: options.machineType,
                    diskSize: options.diskSize,
                    publicIpType: options.publicIpType,
                    region: options.region,
                    zone: options.zone,
                    acceleratorType: options.gpuType,
                    projectId: options.projectId,
                }
            }

            const opts: InstanceInitializationOptions = {
                autoApprove: options.yes,
                overwriteExisting: options.overwriteExisting
            }
 
            await new GcpInstanceInitializer(genericArgs, gcpArgs).initializeInstance(opts)
            
        } catch (error) {
            console.error('Error creating Google Cloud instance:', error)
            process.exit(1)
        }
    })

createCmd
    .command('azure')
    .description('Create a new Cloudy Pad instance using Azure Cloud provider')
    .option('--name <name>', 'Instance name')
    .option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
    .option('--api-key-file <apikeyfile>', 'Path to Paperspace API key file')
    .option('--vm-size <vmsize>', 'Virtual machine size')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', 'Public IP type. Either "static" or "dynamic"')
    .option('--location <location>', 'Location in which to deploy instance')
    .option('--subscription-id <subscriptionid>', 'Subscription ID in which to deploy resources')
    .option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const genericArgs = {
                instanceName: options.name,
                sshKey: options.privateSshKey,
            }

            const azArgs: PartialDeep<AzureProvisionArgs> = {
                create: {
                    vmSize: options.vmSize,
                    diskSize: options.diskSize,
                    publicIpType: options.publicIpType,
                    location: options.location,
                    subscriptionId: options.subscriptionId,
                    useSpot: options.spot,
                }
            }

            const opts: InstanceInitializationOptions = {
                autoApprove: options.yes,
                overwriteExisting: options.overwriteExisting
            }
 
            await new AzureInstanceInitializer(genericArgs, azArgs).initializeInstance(opts)
            
        } catch (error) {
            console.error('Error creating Azure instance:', error)
            process.exit(1)
        }
    })
program
    .command('list')
    .description('List all instances')
    .option('--format <format>', 'Output format, one of [plain|json] ', 'plain')
    .action(async (options) => {
        try {
            const instanceNames = GlobalInstanceManager.getAllInstances();
            if (instanceNames.length === 0) {
                console.info('No instances found.');
                return;
            }

            const outputFormat = options.format

            if(outputFormat == 'json'){
                console.info(JSON.stringify(instanceNames))
            } else if (outputFormat == 'plain') {
                console.info(instanceNames.join("\n"))
            }
            
        } catch (error) {
            console.error('Error listing instances:', error)
            process.exit(1)
        }
    })

program
    .command('start <name>')
    .description('Start an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.start()
            console.info(`Started instance ${name}`)
        } catch (error) {
            console.error(`Error starting instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('stop <name>')
    .description('Stop an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.stop()
            console.info(`Stopped instance ${name}`)
        } catch (error) {
            console.error(`Error stopping instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('restart <name>')
    .description('Restart an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.restart()
            console.info(`Restarted instance ${name}`)
        } catch (error) {
            console.error(`Error restarting instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('get <name>')
    .description('Get details of an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const r = await m.getInstanceRunner()
            const details = await r.get()
            console.info(JSON.stringify(details, null, 2))
        } catch (error) {
            console.error(`Error getting details of instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('provision <name>')
    .description('Provision an instance (deploy or update Cloud resources)')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const p = await m.getInstanceProvisioner()
            await p.provision()
            console.info(`Provisioned instance ${name}`)
        } catch (error) {
            console.error(`Error provisioning instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('configure <name>')
    .description('Configure an instance (connect to instance and install drivers, packages, etc.)')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const p = await m.getInstanceConfigurator()
            await p.configure()
            console.info("")
            console.info(`Configured instance ${name}`)
        } catch (error) {
            console.error(`Error configuring instance ${name}:`, error)
            process.exit(1)
        }
    })

program
    .command('destroy <name>')
    .description('Destroy an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)

            const p = await m.getInstanceProvisioner()
            await p.destroy()

            await m.destroyInstance()

            console.info("")
            console.info(`Destroyed instance ${name}`)

        } catch (error) {
            console.error(`Error destroying instance ${name}:`, error)
            process.exit(1)
        }
    })

program.command('pair <name>')
    .description('Pair an instance with Moonlight')
    .action(async (name: string) => {
        try {
            const m = await GlobalInstanceManager.getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.pair()
        } catch (error) {
            console.error('Error creating new instance:', error)
            process.exit(1)
        }
    })


program.parse(process.argv);
