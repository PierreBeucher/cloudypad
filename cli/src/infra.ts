import { LocalProgramArgs, LocalWorkspace, OutputMap } from "@pulumi/pulumi/automation";
import * as upath from "upath";

export interface BoxInfraDetails {
    host: string,
    ssh: {
        user: string
        port?: number
        privateKey?: string
    }
}


async function createOrSelectPulumiStack(stackName: string){
    
    // Create our stack using a local program
    // in the ../website directory
    const args: LocalProgramArgs = {
        stackName: stackName,
        workDir: upath.joinSafe(__dirname, "..", "..", "infra"),
    };

    // create (or select if one already exists) a stack that uses our local program
    return await LocalWorkspace.createOrSelectStack(args);
}
export async function getBoxDetailsPulumi(stackName: string){
    const stack = await createOrSelectPulumiStack(stackName)
    const outputs = await stack.outputs()
    
    return buildBoxDetails(outputs)
}

function buildBoxDetails(outputs: OutputMap){
    return {
        host: outputs["ipAddress"].value,
        ssh: {
            port: 22,
            user: "root"
        }
    }
}

export async function deployPulumi(stackName: string) : Promise<BoxInfraDetails> {
    
    const stack = await createOrSelectPulumiStack(stackName)

    console.info("Infra - Preview stack changes...")
    await stack.preview({ onOutput: console.info, diff: true })

    console.info("Infra - Updating stack...")
    const upRes = await stack.up({ onOutput: console.info });
    
    console.log(`Infra - Update summary: \n${JSON.stringify(upRes.summary.resourceChanges, null, 4)}`);

    return buildBoxDetails(upRes.outputs)

}