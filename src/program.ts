import { Command } from '@commander-js/extra-typings';
import { setLogVerbosity } from './log/utils';
import { InstanceManagerBuilder } from './core/manager-builder';
import { GcpCliCommandGenerator } from './providers/gcp/cli';
import { AzureCliCommandGenerator } from './providers/azure/cli';
import { AwsCliCommandGenerator } from './providers/aws/cli';
import { PaperspaceCliCommandGenerator } from './providers/paperspace/cli';
import { AnalyticsManager } from './tools/analytics/manager';
import { RUN_COMMAND_CONFIGURE, RUN_COMMAND_DESTROY, RUN_COMMAND_GET, RUN_COMMAND_LIST, RUN_COMMAND_PAIR, RUN_COMMAND_PROVISION, RUN_COMMAND_RESTART, RUN_COMMAND_START, RUN_COMMAND_STOP } from './tools/analytics/events';
import { CLOUDYPAD_VERSION } from './core/const';

export function buildProgram(){

    const analyticsClient = AnalyticsManager.get()
    
    const program = new Command()

    program
        .name('cloudypad')
        .description('Cloudy Pad CLI to manage your own gaming instance in the Cloud.')
        .option("--verbose, -v",
            "Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal). Alternatively, use CLOUDYPAD_LOG_LEVEL environment variable.", 
            (v) => { setLogVerbosity(Number.parseInt(v)) })
        .configureHelp({ showGlobalOptions: true})
        .version(CLOUDYPAD_VERSION)
    
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
                analyticsClient.sendEvent(RUN_COMMAND_LIST)

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
            }
        })
    
    program
        .command('start <name>')
        .description('Start an instance')
        .option('--wait', 'Wait for instance to be fully started.')
        .option('--timeout <seconds>', 'Timeout when waiting for instance to be fully started. Ignored if --wait not set.', parseInt)
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_START)

                console.info(`Starting instance ${name}...`)
                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.start({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
    
                if(opts.wait){
                    console.info(`Started instance ${name}`)
                } else {
                    console.info(`Instance ${name} start triggered. Use --wait flag to wait for completion.`)
                }
    
            } catch (error) {
                console.error(`Error starting instance ${name}:`, error)
            }
        })
    
    program
        .command('stop <name>')
        .description('Stop an instance')
        .option('--wait', 'Wait for instance to be fully stopped.')
        .option('--timeout <seconds>', 'Timeout when waiting for instance to be fully stopped. Ignored if --wait not set.', parseInt)
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_STOP)

                console.info(`Stopping instance ${name}...`)
                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.stop({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
                
                if(opts.wait){
                    console.info(`Stopped instance ${name}`)
                } else {
                    console.info(`Instance ${name} stop triggered. Use --wait flag to wait for completion.`)
                }
    
            } catch (error) {
                console.error(`Error stopping instance ${name}:`, error)
            }
        })
    
    program
        .command('restart <name>')
        .description('Restart an instance. Depending on provider this operation may be synchronous.')
        .option('--wait', 'Wait for instance to be fully restarted.')
        .option('--timeout <seconds>', 'Timeout when waiting for instance to be fully restarted. Ignored if --wait not set.', parseInt)
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_RESTART)

                console.info(`Restarting instance ${name}...`)
                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.restart({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
                
            } catch (error) {
                console.error(`Error restarting instance ${name}:`, error)
            }
        })
    
    program
        .command('get <name>')
        .description('Get details of an instance')
        .action(async (name) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_GET)

                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                const details = m.getStateJSON()
    
                console.info(details)
            } catch (error) {
                console.error(`Error getting details of instance ${name}:`, error)
            }
        })
    
    program
        .command('provision <name>')
        .description('Provision an instance (deploy or update Cloud resources)')
        .option('--yes', 'Do not prompt for approval, automatically approve and continue')
        .action(async (name) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_PROVISION)

                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.provision()
    
                console.info(`Provisioned instance ${name}`)
            } catch (error) {
                console.error(`Error provisioning instance ${name}:`, error)
            }
        })
    
    program
        .command('configure <name>')
        .description('Configure an instance (connect to instance and install drivers, packages, etc.)')
        .action(async (name) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_CONFIGURE)

                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.configure()
    
                console.info("")
                console.info(`Configured instance ${name}`)
            } catch (error) {
                console.error(`Error configuring instance ${name}:`, error)
            }
        })
    
    program
        .command('destroy <name>')
        .description('Destroy an instance')
        .option('--yes', 'Do not prompt for approval, automatically approve and continue')
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_DESTROY)

                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.destroy({ autoApprove: opts.yes})
    
                console.info("")
                console.info(`Destroyed instance ${name}`)
    
            } catch (error) {
                console.error(`Error destroying instance ${name}:`, error)
            }
        })
    
    program.command('pair <name>')
        .description('Pair an instance with Moonlight')
        .action(async (name: string) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_PAIR)
                const m = await new InstanceManagerBuilder().buildInstanceManager(name)
                await m.pair()
            } catch (error) {
                console.error('Error creating new instance:', error)
            }
        })
    
    return program
}
