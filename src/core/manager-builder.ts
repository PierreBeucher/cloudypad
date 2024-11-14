import * as fs from 'fs';
import * as path from 'path';
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { CommonInitConfig, InstanceInitializer } from './initializer';
import { AwsInstanceInitializer } from '../providers/aws/initializer';
import { PaperspaceInstanceInitializer } from '../providers/paperspace/initializer';
import { select } from '@inquirer/prompts';
import { AzureInstanceInitializer } from '../providers/azure/initializer';
import { GcpInstanceInitializer } from '../providers/gcp/initializer';
import { PartialDeep } from 'type-fest';
import { getLogger } from '../log/utils';

/**
 * Utility class to manage instances globally. Instance state
 * are saved under CLOUDYPAD_INSTANCES_DIR, this class function
 * allow to manipulate the content of this directory. 
 */
export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)

    private constructor() {}

    static getAllInstances(): string[] {
        
        try {
            this.logger.debug(`Listing all instances from ${CLOUDYPAD_INSTANCES_DIR}`)

            const instanceDir = fs.readdirSync(CLOUDYPAD_INSTANCES_DIR);

            return instanceDir.filter(dir => fs.existsSync(path.join(CLOUDYPAD_INSTANCES_DIR, dir, 'config.yml')));
        } catch (error) {
            this.logger.error('Failed to read instances directory:', error);
            return [];
        }
    }

    /**
     * Let user select a provider and return the related InstanceInitializer object
     * @param args 
     * @returns 
     */
    static async promptInstanceInitializer(args?: PartialDeep<CommonInitConfig>): Promise<InstanceInitializer>{

        return await select<InstanceInitializer>({
            message: 'Select Cloud provider:',
            choices: [
                { name: CLOUDYPAD_PROVIDER_AWS, value: new AwsInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_PAPERSPACE, value: new PaperspaceInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_AZURE, value: new AzureInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_GCP, value: new GcpInstanceInitializer(args)}
            ]
        })
    }
}