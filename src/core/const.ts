import * as path from 'path';

export const CLOUDYPAD_PROVIDER_AWS = "aws"
export const CLOUDYPAD_PROVIDER_PAPERSPACE = "paperspace"
export const CLOUDYPAD_PROVIDER_AZURE = "azure"
export const CLOUDYPAD_PROVIDER_GCP = "gcp"
export type CLOUDYPAD_PROVIDER = typeof CLOUDYPAD_PROVIDER_AWS | typeof CLOUDYPAD_PROVIDER_PAPERSPACE | typeof CLOUDYPAD_PROVIDER_AZURE | typeof CLOUDYPAD_PROVIDER_GCP

export const CLOUDYPAD_HOME = path.resolve(`${process.env.HOME || ''}/.cloudypad`)
export const CLOUDYPAD_INSTANCES_DIR = path.resolve(`${CLOUDYPAD_HOME}/instances`)