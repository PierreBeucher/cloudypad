import { spawnSync } from "child_process";
import { getLogger } from "../log/utils";

/**
 * Simple wrapper around Ansible commands
 */
export class AnsibleClient {

    private readonly logger = getLogger(AnsibleClient.name)

    async runAnsible(inventoryPath: string, playbookPath: string, additionalAnsibleArgs: string[]){
        const ansibleCommand = 'ansible-playbook'
        const ansibleArgs = ['-i', inventoryPath, playbookPath]
        
        
        if (additionalAnsibleArgs.includes('--skip-tags=reboot')) {
            ansibleArgs.push('--connection=local')
        }
        
        ansibleArgs.push(...additionalAnsibleArgs)

        this.logger.debug(`Ansible command: ${ansibleCommand} ${JSON.stringify(ansibleArgs)}`)

        const ansibleProcess = spawnSync(ansibleCommand, ansibleArgs, { stdio: 'inherit', shell: true });

        this.logger.debug(`Ansible finished with status: ${ansibleProcess.status}`)

        if (ansibleProcess.status != 0) {
            
            this.logger.error(`Ansible run failure: ${JSON.stringify(ansibleProcess)}`)

            throw new Error(`Ansible run failed, exit code ${ansibleProcess.status}`)
        }

        this.logger.trace(`Ansible finished: ${JSON.stringify(ansibleProcess)}`)
    }
}