#! /usr/bin/env node

import { version } from '../package.json';
import { Command } from '@commander-js/extra-typings';
import { setLogVerbosity } from './log/utils';
import { InstanceManagerBuilder } from './core/manager-builder';
import { GcpCliCommandGenerator } from './providers/gcp/input';
import { AzureCliCommandGenerator } from './providers/azure/input';
import { AwsCliCommandGenerator } from './providers/aws/input';
import { PaperspaceCliCommandGenerator } from './providers/paperspace/input';

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

createCmd.addCommand(new AwsCliCommandGenerator().buildCreateCommand())
createCmd.addCommand(new AzureCliCommandGenerator().buildCreateCommand())
createCmd.addCommand(new GcpCliCommandGenerator().buildCreateCommand())
createCmd.addCommand(new PaperspaceCliCommandGenerator().buildCreateCommand())

const updateCmd = program
    .command('update')
    .description('Update an existing instance. See subcommands for each provider options.')

updateCmd.addCommand(new AwsCliCommandGenerator().buildUpdateCommand())
updateCmd.addCommand(new AzureCliCommandGenerator().buildUpdateCommand())
updateCmd.addCommand(new GcpCliCommandGenerator().buildUpdateCommand())
updateCmd.addCommand(new PaperspaceCliCommandGenerator().buildUpdateCommand())

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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
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
            const m = await new InstanceManagerBuilder().buildInstanceManager(name)
            await m.pair()
        } catch (error) {
            console.error('Error creating new instance:', error)
            process.exit(1)
        }
    })


program.parse(process.argv);

