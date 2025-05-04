import { Command } from '@commander-js/extra-typings';
import { getLogger, setLogVerbosity } from '../log/utils';
import { GcpCliCommandGenerator } from '../providers/gcp/cli';
import { AzureCliCommandGenerator } from '../providers/azure/cli';
import { AwsCliCommandGenerator } from '../providers/aws/cli';
import { PaperspaceCliCommandGenerator } from '../providers/paperspace/cli';
import { AnalyticsManager } from '../tools/analytics/manager';
import { RUN_COMMAND_CONFIGURE, RUN_COMMAND_DEPLOY, RUN_COMMAND_DESTROY, RUN_COMMAND_GET, RUN_COMMAND_LIST, RUN_COMMAND_PAIR, RUN_COMMAND_PROVISION, RUN_COMMAND_RESTART, RUN_COMMAND_START, RUN_COMMAND_STOP } from '../tools/analytics/events';
import { CLOUDYPAD_VERSION } from '../core/const';
import { confirm } from '@inquirer/prompts';
import { ConfirmationPrompter } from './prompter';
import { ScalewayCliCommandGenerator } from '../providers/scaleway/cli';
import { DummyCliCommandGenerator } from '../providers/dummy/cli';
import { DefaultConfigValues } from '../core/config/default';
import { CloudypadClient } from '../core/client';

const logger = getLogger("program")

export function handleErrorAnalytics(e: unknown){
    const eventProps = e instanceof Error ? { errorMessage: e.message, stackTrace: e.stack } : { errorMessage: String(e), stackTrace: "unknown" }
    AnalyticsManager.get().sendEvent("error", eventProps)
}

export async function shutdownAnalytics(){
    await AnalyticsManager.get().shutdown()
}

export async function cleanupAndExit(exitCode: number){
    await shutdownAnalytics()
    process.exit(exitCode)
}

export function logFullError(e: unknown, prefix?: string){
    if(e instanceof Error){
        prefix ? logger.error(prefix, e) : logger.error(e)
        if(e.cause){
            logFullError(e.cause, "Caused by:")
        }
    } else {
        logger.error("Unknown error", e)
    }
}

function buildCoreClient(): CloudypadClient {
    const defaultConfig = DefaultConfigValues.buildDefaultConfig()
    logger.debug("Building core client with config: " + JSON.stringify(defaultConfig))

    const client = new CloudypadClient({
        config: defaultConfig
    })
    return client
}

export function buildProgram(){

    const analyticsClient = AnalyticsManager.get()
    const coreClient = buildCoreClient()
    const program = new Command()

    program
        .name('cloudypad')
        .description('Cloudy Pad CLI to manage your own gaming instance in the Cloud.')
        .option("-v, --verbose",
            "Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal). Alternatively, use CLOUDYPAD_LOG_LEVEL environment variable.", 
            (v) => { setLogVerbosity(Number.parseInt(v)) })
        .configureHelp({ showGlobalOptions: true})
        .version(CLOUDYPAD_VERSION)
    
    const createCmd = program
        .command('create')
        .description('Create a new instance. See subcommands for each provider options.')
    
    createCmd.addCommand(new AwsCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }))
    createCmd.addCommand(new AzureCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }))
    createCmd.addCommand(new GcpCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }))
    createCmd.addCommand(new PaperspaceCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }))
    createCmd.addCommand(new ScalewayCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }))
    createCmd.addCommand(new DummyCliCommandGenerator().buildCreateCommand({ coreClient: coreClient }), { hidden: true })
    
    const updateCmd = program
        .command('update')
        .description('Update an existing instance. See subcommands for each provider options.')
    
    updateCmd.addCommand(new AwsCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }))
    updateCmd.addCommand(new AzureCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }))
    updateCmd.addCommand(new GcpCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }))
    updateCmd.addCommand(new PaperspaceCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }))
    updateCmd.addCommand(new ScalewayCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }))
    updateCmd.addCommand(new DummyCliCommandGenerator().buildUpdateCommand({ coreClient: coreClient }), { hidden: true })

    program
        .command('list')
        .description('List all instances')
        .option('--format <format>', 'Output format, one of [plain|json] ', 'plain')
        .action(async (options) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_LIST)

                const instanceNames = await coreClient.getAllInstances();
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
                throw new Error('Failed to list instances', { cause: error })
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
                const m = await coreClient.buildInstanceManager(name)
                await m.start({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
    
                if(opts.wait){
                    console.info(`Started instance ${name}`)
                } else {
                    console.info(`Instance ${name} start triggered. Use --wait flag to wait for completion.`)
                }
    
            } catch (error) {
                throw new Error(`Failed to start instance ${name}`, { cause: error })
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
                const m = await coreClient.buildInstanceManager(name)
                await m.stop({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
                
                if(opts.wait){
                    console.info(`Stopped instance ${name}`)
                } else {
                    console.info(`Instance ${name} stop triggered. Use --wait flag to wait for completion.`)
                }
    
            } catch (error) {
                throw new Error(`Failed to stop instance ${name}`, { cause: error })
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
                const m = await coreClient.buildInstanceManager(name)
                await m.restart({ wait: opts.wait, waitTimeoutSeconds: opts.timeout})
                
            } catch (error) {
                throw new Error(`Failed to restart instance ${name}`, { cause: error })
            }
        })
    
    program
        .command('get <name>')
        .description('Get details of an instance')
        .action(async (name) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_GET)

                const m = await coreClient.buildInstanceManager(name)
                const details = m.getStateJSON()
    
                console.info(details)
            } catch (error) {
                throw new Error(`Failed to get details of instance ${name}`, { cause: error })
            }
        })
    
    program
        .command('provision <name>')
        .description('Provision an instance (deploy or update Cloud resources)')
        .option('--yes', 'Do not prompt for approval, automatically approve and continue')
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_PROVISION)

                const manager = await coreClient.buildInstanceManager(name)
                const inputs = await manager.getInputs()
                const prompter = new ConfirmationPrompter()

                const confirmation = await prompter.confirmDeploy(name, inputs, opts.yes)
                if(!confirmation){
                    throw new Error('Provision aborted.')
                }

                await manager.provision()
    
                console.info(`Provisioned instance ${name}`)
            } catch (error) {
                throw new Error(`Failed to provision instance ${name}`, { cause: error })
            }
        })
    
    program
        .command('configure <name>')
        .description('Configure an instance (connect to instance and install drivers, packages, etc.)')
        .action(async (name) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_CONFIGURE)

                const m = await coreClient.buildInstanceManager(name)
                await m.configure()
    
                console.info("")
                console.info(`Configured instance ${name}`)
            } catch (error) {
                throw new Error(`Failed to configure instance ${name}`, { cause: error })
            }
        })
    
    program
        .command('deploy <name>')
        .option('--yes', 'Do not prompt for approval, automatically approve and continue')
        .description('Deploy an instance: provision and configure it. Equivalent to running provision and configure commands sequentially.')
        .action(async (name, opts) => {

            const manager = await coreClient.buildInstanceManager(name)
            const inputs = await manager.getInputs()
            const prompter = new ConfirmationPrompter()

            const confirmation = await prompter.confirmDeploy(name, inputs, opts.yes)
            if(!confirmation){
                throw new Error('Deploy aborted.')
            }

            analyticsClient.sendEvent(RUN_COMMAND_DEPLOY)

            await manager.deploy()
        })

    program
        .command('destroy <name>')
        .description('Destroy an instance')
        .option('--yes', 'Do not prompt for approval, automatically approve and continue')
        .action(async (name, opts) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_DESTROY)

                let approveDestroy: boolean | undefined = opts?.yes
                if(approveDestroy === undefined){
                    approveDestroy = await confirm({
                        message: `You are about to destroy instance '${name}'. Please confirm:`,
                        default: false,
                    })
                }
        
                if (!approveDestroy) {
                    throw new Error('Destroy aborted.')
                }

                const m = await coreClient.buildInstanceManager(name)
                await m.destroy()
    
                console.info("")
                console.info(`Destroyed instance ${name}`)
    
            } catch (error) {
                throw new Error(`Failed to destroy instance ${name}`, { cause: error })
            }
        })
    
    program.command('pair <name>')
        .description('Pair an instance with Moonlight')
        .action(async (name: string) => {
            try {
                analyticsClient.sendEvent(RUN_COMMAND_PAIR)
                const m = await coreClient.buildInstanceManager(name)
                await m.pairInteractive()
            } catch (error) {
                throw new Error('Failed to pair instance', { cause: error })
            }
        })
    
    return program
}


