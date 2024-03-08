import { Command } from 'commander';
import * as emoji from "node-emoji"
import { getBoxManager } from './lib/core.js';
import * as logging from "./lib/logging.js"

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
  .action((name: string) => {
    getBoxDetails(name)
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

wolfCmd.command("get-pin <name>")
  .description("Get PIN from Wolf instance logs")
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
    await bm.deploy()
    console.info(`${emoji.get("white_check_mark")} Deployed: ${boxName}...`)
}

async function provision(boxName: string) {
  console.info(`${emoji.get("gear")} Provisioning box: ${boxName}...`)
  const bm = getBoxManager(boxName)
  await bm.provision()
  console.info(`${emoji.get("white_check_mark")} Provisioned: ${boxName}...`)
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
  console.info(`${emoji.get("boom")} Destroyed ${boxName}...`)
}

async function getWolfPin(boxName: string){
  const bm = getBoxManager(boxName)
  const wolfPinUrl = await bm.getWolfPinUrl()

  console.info(`Connect to ${wolfPinUrl} to validate PIN.`)
}

async function getBoxDetails(boxName: string){
    const bm = getBoxManager(boxName)
    const outputs = bm.get()
    console.info(JSON.stringify(outputs, undefined, 2))
}

async function listBoxes(){
  throw new Error("Not implemented")
  // const boxes = await pulumi.list("wolf-aws")
  // console.info(JSON.stringify(boxes))
}