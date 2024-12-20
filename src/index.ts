#! /usr/bin/env node

import { version } from '../package.json';
import { Command } from '@commander-js/extra-typings';
import { setLogVerbosity } from './log/utils';
import { AwsInstanceInitArgs, AwsInstanceInitializer } from './providers/aws/initializer';
import { PaperspaceInstanceInitArgs, PaperspaceInstanceInitializer } from './providers/paperspace/initializer';
import { InstanceInitializationOptions } from './core/initializer';
import { AzureInstanceInitArgs, AzureInstanceInitializer } from './providers/azure/initializer';
import { GcpInstanceInitArgs, GcpInstanceInitializer } from './providers/gcp/initializer';
import { InstanceManagerBuilder } from './core/manager-builder';
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from './core/const';

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
    .description('Create a new instance. See subcommands for each provider options.')

createCmd
    .command('aws')
    .description('Create a new Cloudy Pad instance using AWS Cloud provider')
    .option('--name <name>', 'Instance name')
    .option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
    .option('--instance-type <type>', 'EC2 instance type')
    .option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', `Public IP type. Either ${PUBLIC_IP_TYPE_STATIC} or ${PUBLIC_IP_TYPE_DYNAMIC}`, parsePublicIpType)
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const args: AwsInstanceInitArgs = {
                instanceName: options.name,
                config: {
                    ssh: {
                        privateKeyPath: options.privateSshKey,
                    },
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

            await new AwsInstanceInitializer(args).initializeInstance(opts)

            afterInitInfo()
            
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
    .option('--public-ip-type <type>', `Public IP type. Either ${PUBLIC_IP_TYPE_STATIC} or ${PUBLIC_IP_TYPE_DYNAMIC}`, parsePublicIpType)
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {
            const args: PaperspaceInstanceInitArgs = {
                instanceName: options.name,
                config: {
                    ssh: {
                        privateKeyPath: options.privateSshKey
                    },
                    apiKey: options.apiKeyFile,
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
 
            await new PaperspaceInstanceInitializer(args).initializeInstance(opts)

            afterInitInfo()
            
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
    .option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 60% to 90% off) but may be restarted any time.')
    .option('--disk-size <size>', 'Disk size in GB', parseInt)
    .option('--public-ip-type <type>', `Public IP type. Either ${PUBLIC_IP_TYPE_STATIC} or ${PUBLIC_IP_TYPE_DYNAMIC}`, parsePublicIpType)
    .option('--region <region>', 'Region in which to deploy instance')
    .option('--zone <zone>', 'Zone in which to deploy instance')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {

            const args: GcpInstanceInitArgs = {
                instanceName: options.name,
                config: {
                    ssh: {
                        privateKeyPath: options.privateSshKey
                    },
                    machineType: options.machineType,
                    diskSize: options.diskSize,
                    publicIpType: options.publicIpType,
                    region: options.region,
                    zone: options.zone,
                    acceleratorType: options.gpuType,
                    projectId: options.projectId,
                    useSpot: options.spot,
                }
            }

            const opts: InstanceInitializationOptions = {
                autoApprove: options.yes,
                overwriteExisting: options.overwriteExisting
            }
 
            await new GcpInstanceInitializer(args).initializeInstance(opts)

            afterInitInfo()
            
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
    .option('--public-ip-type <type>', `Public IP type. Either ${PUBLIC_IP_TYPE_STATIC} or ${PUBLIC_IP_TYPE_DYNAMIC}`, parsePublicIpType)
    .option('--location <location>', 'Location in which to deploy instance')
    .option('--subscription-id <subscriptionid>', 'Subscription ID in which to deploy resources')
    .option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.')
    .option('--yes', 'Do not prompt for approval, automatically approve and continue')
    .option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
    .action(async (options) => {
        try {

            const args: AzureInstanceInitArgs = {
                instanceName: options.name,
                config: {
                    ssh: {
                        privateKeyPath: options.privateSshKey
                    },
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
 
            await new AzureInstanceInitializer(args).initializeInstance(opts)

            afterInitInfo()
            
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
            const instanceNames = new InstanceManagerBuilder().getAllInstances();
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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.start()
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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.stop()
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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.restart()
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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            const details = m.getStateJSON()

            console.info(details)
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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.provision()

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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.configure()

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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.destroy()

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
            const m = await new InstanceManagerBuilder().buildManagerForInstance(name)
            await m.pair()
        } catch (error) {
            console.error('Error creating new instance:', error)
            process.exit(1)
        }
    })


program.parse(process.argv);

function afterInitInfo(){
    console.info("")
    console.info("Instance has been initialized successfully 🥳")
    console.info("")
    console.info("If you like Cloudy Pad please leave us a star ⭐ https://github.com/PierreBeucher/cloudypad")
    console.info("")
    console.info("🐛 A bug ? Some feedback ? Do not hesitate to file an issue: https://github.com/PierreBeucher/cloudypad/issues")    
}

function parsePublicIpType(value: string): PUBLIC_IP_TYPE {
    if (value !== PUBLIC_IP_TYPE_STATIC && value !== PUBLIC_IP_TYPE_DYNAMIC) {
        throw new Error(`Invalid value for --public-ip-type. Either "${PUBLIC_IP_TYPE_STATIC}" or "${PUBLIC_IP_TYPE_DYNAMIC}"`)
    }
    return value
}