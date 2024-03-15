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

program.command('deploy <box>')
  .description('Deploy an instance')
  .action(async (box: string) => {
    await deploy(box)
  })

program.command('provision <box>')
  .description('Provison an instance')
  .action(async (box: string) => {
    await provision(box)
  })

program.command('preview <box>')
  .description('Preview changes for an instance deployment')
  .action(async (box: string) => {
    await preview(box)
})

program.command('destroy <box>')
  .description('Destroy an instance')
  .action(async (box: string) => {
    await destroy(box)
  });

program.command('get <box>')
  .description('Get details of an instance')
  .action(async (box: string) => {
    await getBoxDetails(box)
  });

program.command('stop <box>')
  .description('Stop an instance')
  .action(async (box: string) => {
    await stop(box)
  });

program.command('start <box>')
  .description('Start an instance')
  .action(async (box: string) => {
    await start(box)
  });

program.command('restart <box>')
  .description('Restart an instance')
  .action(async (box: string) => {
    await restart(box)
  });

  
program.command('list')
  .description('List all instances')
  .action(async () => {
    await listBoxes()
  });

// Utils subcommands for some box
const utils = program.command('utils')
  .description('Utilities for cloudybox');

const wolfCmd = utils.command("wolf")
  .description("Wolf utils commands")

wolfCmd.command("open-pin <box>")
  .description("Open a browser to enter Wolf PIN")
  .action((box: string) => {
    getWolfPin(box)
  })


program.exitOverride((e) => {
  console.error(`Something went wrong: ${e}`) 
  console.error(`See full logs at: ${logging.tmpLogFile}`)
  process.exit(1)
}).parse(process.argv)

async function deploy(box: string) {
    const bm = await getBoxManager(box)
    const meta = await bm.getMetadata()
    console.info(`${emoji.get("rocket")} Deploying ${meta.kind} box ${meta.name}...`)
    const o = await bm.deploy()
    console.info(`${emoji.get("white_check_mark")} ${meta.name} deployed !`)
    console.info(JSON.stringify(o, undefined, 2))
}

async function provision(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()

  console.info(`${emoji.get("gear")} Provisioning ${meta.kind} box ${meta.name}...`)

  const o = await bm.provision()
  console.info(`${emoji.get("white_check_mark")} Provisioned: ${meta.name}...`)
  console.info(JSON.stringify(o, undefined, 2))
}

async function preview(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()
  console.info(`${emoji.get("cloud")} Previewing ${meta.kind} box ${meta.name}`)
  await bm.preview()
}

async function destroy(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()
  console.info(`${emoji.get("bomb")} Destroying ${meta.kind} box ${meta.name}...`)
  await bm.destroy()
  console.info(`${emoji.get("boom")} Destroyed ${meta.name}`)
}

async function restart(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()
  console.info(`${emoji.get("recycle")} Restarting ${meta.kind} box ${meta.name}...`)
  await bm.restart()
  console.info(`${emoji.get("white_check_mark")} Restarted ${meta.name}`)
}

async function start(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()
  console.info(`${emoji.get("rocket")} Starting ${meta.kind} box ${meta.name}...`)
  await bm.start()
  console.info(`${emoji.get("white_check_mark")} Started ${meta.name}...`)
}

async function stop(box: string) {
  const bm = await getBoxManager(box)
  const meta = await bm.getMetadata()
  console.info(`${emoji.get("stop_sign")} Stopping ${meta.kind} box ${meta.name}...`)
  await bm.stop()
  console.info(`${emoji.get("white_check_mark")} Stopped ${meta.name}`)
}

async function getWolfPin(box: string){
  const bm = await getBoxManager(box)
  if(bm instanceof WolfBoxManager){ // TODO better check
    const wolfPinUrl = await bm.getWolfPinUrl()
    console.info(`Opening ${wolfPinUrl} in default browser...`)
    open(wolfPinUrl);
  }
}

async function getBoxDetails(box: string){
    const bm = await getBoxManager(box)
    const outputs = await bm.get()
    console.info(JSON.stringify(outputs, undefined, 2))
}

async function listBoxes(){
  throw new Error("Not implemented")
  // const boxes = await pulumi.list("wolf-aws")
  // console.info(JSON.stringify(boxes))
}