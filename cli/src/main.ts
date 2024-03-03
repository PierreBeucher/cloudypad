import yargs from "yargs/yargs";
import * as infra from "./infra.js"
import * as provisioning from "./provisioning.js"
// import * as logging from "./logging.js";
import * as emoji from "node-emoji"

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
})
.command('utils [wolf]', 'Utilitary functions for various boxes templates.', (yargs) => {
    return yargs.command('wolf [get-pin]', 'Wolf utils commands', (yargs) => {
        yargs.command("get-pin <box>", "Get the PIN code from Wolf output", (yargs) => {
            yargs.positional('box', {
                describe: "Box name",
                type: 'string'
            })
        }, async (args) => {
            const boxName = args.box as string
            getWolfPin(boxName)
        })
    })
})
.demandCommand()
.help()
.parseAsync()

yargResult.catch(e => console.error(e))

async function deploy(boxName: string) {
    await deployInfra(boxName)
    await provision(boxName)
}

async function deployInfra(boxName: string) {
    console.info(`${emoji.get("cloud")} Updating Cloud stack`)
    await infra.deployPulumi(boxName)
}

async function provision(boxName: string) {
    console.info(`${emoji.get("snowflake")} Provisioning box`)
    const box = await infra.getBoxDetailsPulumi(boxName)
    await provisioning.nixSshProvision(box, "wolf-aws.nix")
    // TODO as systemd service or aliased command
    await provisioning.runSshCommand(box, ["/root/wolf/docker-nvidia-start.sh"])
}

async function getWolfPin(boxName: string){
    const box = await infra.getBoxDetailsPulumi(boxName)
    
    // Returns exactly 1 line
    // Extract HTTP address and replace by box IP
    const sshResp = await provisioning.runSshCommand(box, ["sh", "-c", "docker logs wolf-wolf-1 2>&1 | grep -a 'Insert pin at' | tail -n 1"])

    const urlRegex = /(http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/pin\/#[0-9A-F]+)/;
    const match = sshResp.stdout.match(urlRegex);

    if (match) {
        const url = match[0];
        const replacedUrl = url.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, box.host);

        console.log(`Open browser at ${replacedUrl} to validate PIN`);
    } else {
        console.log("PIN validation URL not found in Wolf logs.");
    }

}

async function getBoxDetails(boxName: string){
    const box = await infra.getBoxDetailsPulumi(boxName)
    console.info(JSON.stringify(box, undefined, 2))
}
