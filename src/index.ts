#! /usr/bin/env node

import { version } from '../package.json';
import { Command } from 'commander';
import { GlobalInstanceManager } from './core/manager';
import { setDefaultVerbosity } from './log/utils';

const program = new Command();

program
    .name('cloudypad')
    .description('Cloudy Pad CLI to manage your own gaming instance in the Cloud.')
    .option("--verbose, -v",
        "Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal)", 
        (v) => { setDefaultVerbosity(Number.parseInt(v)) })
    .configureHelp({ showGlobalOptions: true})
    .version(version);

program
    .command('list')
    .description('List all instances')
    .action(async () => {
        try {
            const instanceNames = GlobalInstanceManager.get().getAllInstances();
            if (instanceNames.length === 0) {
                console.info('No instances found.');
                return;
            }
            console.info(instanceNames.join("\n"))
        } catch (error) {
            console.error('Error listing instances:', error);
        }
    })

program
    .command('create [name]')
    .description('Create a new instance')
    .action(async (name) => {
        try {
            await GlobalInstanceManager.get().createInstance({ name: name });
        } catch (error) {
            console.error('Error creating new instance:', error);
        }
    })

program
    .command('start <name>')
    .description('Start an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.start()
            console.info(`Started instance ${name}`)
        } catch (error) {
            console.error(`Error starting instance ${name}:`, error);
        }
    })

program
    .command('stop <name>')
    .description('Stop an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const r = await m.getInstanceRunner()
            console.info(`Stopped instance ${name}`)
            await r.stop()
        } catch (error) {
            console.error(`Error stopping instance ${name}:`, error);
        }
    })

program
    .command('restart <name>')
    .description('Restart an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.restart()
            console.info(`Restarted instance ${name}`)
        } catch (error) {
            console.error(`Error restarting instance ${name}:`, error);
        }
    })

program
    .command('get <name>')
    .description('Get details of an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const r = await m.getInstanceRunner()
            const details = await r.get()
            console.info(JSON.stringify(details, null, 2))
        } catch (error) {
            console.error(`Error getting details of instance ${name}:`, error);
        }
    })

program
    .command('provision <name>')
    .description('Provision an instance (deploy or update Cloud resources)')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const p = await m.getInstanceProvisioner()
            await p.provision()
            console.info(`Provisioned instance ${name}`)
        } catch (error) {
            console.error(`Error provisioning instance ${name}:`, error);
        }
    })

program
    .command('configure <name>')
    .description('Configure an instance (connect to instance and install drivers, packages, etc.)')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const p = await m.getInstanceConfigurator()
            await p.configure()
            console.info("")
            console.info(`Configured instance ${name}`)
        } catch (error) {
            console.error(`Error configuring instance ${name}:`, error);
        }
    })

program
    .command('destroy <name>')
    .description('Destroy an instance')
    .action(async (name) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)

            if (m.isProvisioned()) {

                const p = await m.getInstanceProvisioner()
                await p.destroy()
            }

            await m.destroyInstance()

            console.info("")
            console.info(`Destroyed instance ${name}`)

        } catch (error) {
            console.error(`Error destroying instance ${name}:`, error);
        }
    })

program.command('pair <name>')
    .description('Pair an instance with Moonlight')
    .action(async (name: string) => {
        try {
            const m = await GlobalInstanceManager.get().getInstanceManager(name)
            const r = await m.getInstanceRunner()
            await r.pair()
        } catch (error) {
            console.error('Error creating new instance:', error);
        }
    })


program.parse(process.argv);
