import yargs from 'yargs/yargs';
import * as infra from './infra'
import * as provisioning from "./provisioning"

const yargResult = yargs(process.argv.slice(2)).command('box [deploy|destroy|list]', 'Manage boxes', (yargs) => {
    return yargs.command('list', 'List all boxes', () => {
        // TODO
    })
    .command('deploy <name>', 'Deploy a box', (yargs) => {
        yargs.positional('name', {
            describe: "Box name",
            type: 'string'
        })
    }, async (args) => {
        console.info(`Deploying ${args.name}`)
        await deploy("dev")
    })
    .command('provision <name>', 'Run box provisioning', (yargs) => {
        yargs.positional('name', {
            describe: "Box name",
            type: 'string'
        })
    }, async (args) => {
        console.info(`Provisioning ${args.name}`)
        await provision("dev")
    })
    .command('destroy', 'Delete a box', (yargs) => {
        console.info(yargs)
        // TODO
    })
    .command('get <name>', 'Get details about a box', (yargs) => {
        yargs.positional('name', {
            describe: "Box name",
            type: 'string'
        })
    }, async (args) => {
        const boxName = args.name as string
        await getBoxDetails(boxName)
    })
    .command('ssh', 'SSH into a box', (yargs) => {
        console.info(yargs)
        // TODO
    })
}, (argv) => {
    console.log(argv);
})
.demandCommand()
.help()
.parseAsync()

yargResult.then(() => {
    console.info("END")
}).
catch(e => console.error(e))

async function deploy(boxName: string) {
    await deployInfra(boxName)
    await provision(boxName)
}

async function deployInfra(boxName: string) {
    await infra.deployPulumi(boxName)
}

async function provision(boxName: string) {
    const box = await infra.getBoxDetailsPulumi(boxName)
    await provisioning.nixSshProvision(box, "wolf-aws.nix")
    await provisioning.wolfSshProvisioning(box)
}

async function getBoxDetails(boxName: string){
    const box = await infra.getBoxDetailsPulumi(boxName)
    console.info(JSON.stringify(box, undefined, 2))
}