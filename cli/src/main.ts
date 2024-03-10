import { Command } from 'commander';
import * as emoji from "node-emoji"
import { getBoxManager } from './lib/core.js';
import * as logging from "./lib/logging.js"
import open from 'open';
import { WolfBoxManager } from './boxes/gaming/wolf.js';

const program = new Command();

program.name('cloudybox')
  .description('Manage CloudyBox instances')
  .version('0.1.0');

program.command('deploy <name>')
  .description('Deploy an instance')
  .action((name: string) => {
    deploy(name)
  })

program.command('provision <name>')
  .description('Provison an instance')
  .action((name: string) => {
    provision(name)
  })

program.command('preview <name>')
  .description('Preview changes for an instance deployment')
  .action((name: string) => {
    preview(name)
})

program.command('destroy <name>')
  .description('Destroy an instance')
  .action((name: string) => {
    console.log(`Destroying instance named ${name}`);
    destroy(name)
  });

program.command('get <name>')
  .description('Get details of an instance')
  .action(async (name: string) => {
    await getBoxDetails(name)
  });

program.command('stop <name>')
  .description('Stop an instance')
  .action(async (name: string) => {
    await stop(name)
  });

program.command('start <name>')
  .description('Start an instance')
  .action(async (name: string) => {
    await start(name)
  });

program.command('restart <name>')
  .description('Restart an instance')
  .action(async (name: string) => {
    await restart(name)
  });

  
program.command('list')
  .description('List all instances')
  .action(() => {
    listBoxes()
  });

// Utils subcommands for some box
const utils = program.command('utils')
  .description('Utilities for cloudybox');

const wolfCmd = utils.command("wolf")
  .description("Wolf utils commands")

wolfCmd.command("open-pin <name>")
  .description("Open a browser to enter Wolf PIN")
  .action((name: string) => {
    getWolfPin(name)
  })


program.exitOverride((e) => {
  console.error(`Something went wrong: ${e}`) 
  console.error(`See full logs at: ${logging.tmpLogFile}`)
  process.exit(1)
}).parse(process.argv)

async function deploy(boxName: string) {
    console.info(`${emoji.get("rocket")} Deploying box: ${boxName}...`)
    const bm = getBoxManager(boxName)
    const o = await bm.deploy()
    console.info(`${emoji.get("white_check_mark")} Deployed: ${boxName}`)
    console.info(JSON.stringify(o, undefined, 2))
}

async function provision(boxName: string) {
  console.info(`${emoji.get("gear")} Provisioning box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  const o = await bm.provision()
  console.info(`${emoji.get("white_check_mark")} Provisioned: ${boxName}...`)
  console.info(JSON.stringify(o, undefined, 2))
}

async function preview(boxName: string) {
    console.info(`${emoji.get("cloud")} Previewing updates of Cloud stack`)
    const bm = getBoxManager(boxName)
    await bm.preview()
}

async function destroy(boxName: string) {
  console.info(`${emoji.get("bomb")} Destroying box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  await bm.destroy()
  console.info(`${emoji.get("boom")} Destroyed ${boxName}`)
}

async function restart(boxName: string) {
  console.info(`${emoji.get("recycle")} Restarting box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  await bm.reboot()
  console.info(`${emoji.get("white_check_mark")} Restarted ${boxName}`)
}

async function start(boxName: string) {
  console.info(`${emoji.get("rocket")} Starting box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  await bm.start()
  console.info(`${emoji.get("white_check_mark")} Started ${boxName}...`)
}

async function stop(boxName: string) {
  console.info(`${emoji.get("stop_sign")} Stopping box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  await bm.stop()
  console.info(`${emoji.get("white_check_mark")} Stopped ${boxName}`)
}

async function getWolfPin(boxName: string){
  const bm = getBoxManager(boxName)
  if(bm instanceof WolfBoxManager){
    const wolfPinUrl = await bm.getWolfPinUrl()
    console.info(`Opening ${wolfPinUrl} in default browser...`)
    open(wolfPinUrl);
  }
}

async function getBoxDetails(boxName: string){
    const bm = getBoxManager(boxName)
    const outputs = await bm.get()
    console.info(JSON.stringify(outputs, undefined, 2))
}

async function listBoxes(){
  throw new Error("Not implemented")
  // const boxes = await pulumi.list("wolf-aws")
  // console.info(JSON.stringify(boxes))
}