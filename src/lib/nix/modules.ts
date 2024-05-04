import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from 'tslog';
import { CloudyBoxLogObjI, componentLogger } from '../logging.js';

/**
 * A NixOS module representation. This interface allow link between local
 * NixOS modules and their copy on target host under /etc/nixos. 
 */
export interface NixOSModule {
    /**
     * Module name. Must be set if `sourcePath` it not set. If not set and `sourcePath` is set,
     * will use `sourcePath` basename as module name. 
     */
    name?: string,

    /**
     * Concrete Nix module content as plain string. Mutually exclusive with `sourcePath`.
     */
    sourceContent?: string,

    /**
     * Concrete Nix module file path. Mutually exclusive with `sourceContent`.
     */
    sourcePath?: string,

    /**
     * Subdirectory of `/etc/nixos` where module file will be copied on target. Default to `/etc/nixos/modules/<name>`.
     */
    targetSubDir?: string

    /**
     * Other modules on which this module depends. If this module is used on target,
     * all dependent modules will be included and copied on host as well. 
     */
    dependsOn?: NixOSModule[]

    /**
     * Whether or not to import module in main NixOS configuration. If true, module file(s) will be copied
     * on target host without being referenced directly. 
     */
    skipImport?: boolean
}

/**
 * Safe-typed NixOSModule for internal use
 */
interface SafeNixOSModule {
    
    name: string

    source: {
        type: "path" | "string"
        value: string
    }

    targetSubDir: string

    dependsOn: SafeNixOSModule[]

    skipImport: boolean
}

/**
 * Build a NixOS configuration file using flake.nix and module hierarchy based on provided modules. 
 */
export class NixOSFlakeBuilder {

    readonly logger: Logger<CloudyBoxLogObjI> = componentLogger.getSubLogger({ name: `NixosFlakeBuilder` })

    readonly modules: SafeNixOSModule[] = []

    add(module: NixOSModule) : NixOSFlakeBuilder {
        this.logger.debug(`Adding module ${JSON.stringify(module)}`)
        this.modules.push(this.makeSafe(module))
        return this
    }

    makeSafe(module: NixOSModule) : SafeNixOSModule {
        if (!module.sourceContent && !module.sourcePath || module.sourceContent && module.sourcePath) {
            throw new Error(`One of sourceContent or sourcePath must be set, but not both. Got: ${JSON.stringify(module)}`);
        }

        if (!module.name && !module.sourcePath){
            throw new Error(`One of module name or sourcePath must be set to define final module name. Got: ${JSON.stringify(module)}`);
        }

        // At this point, either is set:
        // - name and sourceContent
        // - sourcePath
        const sourceType = module.sourceContent ? "string" : "path"
        const sourceValue = module.sourceContent ? module.sourceContent : module.sourcePath!
        const moduleName = module.name || path.basename(module.sourcePath!)
        const targetSubDir = module.targetSubDir ?? 'modules'

        // Parse other modules recursively
        const dependsOn = (module.dependsOn || []).map(m => this.makeSafe(m))

        return {
            name: moduleName,
            dependsOn: dependsOn,
            source: { type: sourceType, value: sourceValue },
            targetSubDir: targetSubDir,
            skipImport: module.skipImport ?? false
        }
    }

    buildFlake() : SafeNixOSModule {
        // TODO NixOS version

        const importedModules = this.modules.filter(m => !m.skipImport)

        const flakeContent = `{
            inputs.nixpkgs.url = github:NixOS/nixpkgs/nixos-unstable;
            inputs.home-manager.url = github:nix-community/home-manager;
            
            outputs = { self, nixpkgs, ... }@attrs: {
                nixosConfigurations.cloudybox = nixpkgs.lib.nixosSystem {
                    system = "x86_64-linux";
                    specialArgs = attrs;
                    modules = [ 
                        ${importedModules.map(m => `./${m.targetSubDir}/${m.name}`).join("\n              ")}
                    ];
                };
            };
        }`
        
        return {
            source: { type: "string", value: flakeContent },
            name: "flake.nix",
            dependsOn: this.modules,
            targetSubDir: "", // empty to put it under /etc/nixos
            skipImport: true
        } 
    }

    /**
     * Build the NixOS module hierarchy for this builder on a temporary directory. 
     * 
     * @returns path to temporary directory containing NixOS flake.nix
     */
    async build() : Promise<string> {
        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cloudybox-nixos-config-'));

        this.logger.debug(`Building modules in ${JSON.stringify(tempDir)}`)

        const flakeModule = this.buildFlake()
        await this.buildRecur(tempDir, flakeModule)

        return tempDir
    }

    private async buildRecur(tmpDir: string, module: SafeNixOSModule) {

        // Will copy module under <tmpDir>/<subDir>/<moduleName>
        // eg. /tmp/nixos-build-dir/modules/my-module.nix
        // or /tmp/nixos-build-dir/custom/submodule/dir/my-module
        const absoluteTargetSubdirPath = path.join(tmpDir, module.targetSubDir);
        const absoluteTargetPath = path.join(absoluteTargetSubdirPath, module.name);
    
        //Ensure suub-directory exists
        await fs.promises.mkdir(absoluteTargetSubdirPath, { recursive: true });

        switch(module.source.type){
            case 'path': {
                const sourcePath = module.source.value

                const stats = await fs.promises.stat(sourcePath);            
        
                if (stats.isDirectory() || stats.isFile()) {
                    this.logger.debug(`Copying ${JSON.stringify(sourcePath)} to ${absoluteTargetPath}`)
                    
                    await fs.promises.cp(sourcePath, absoluteTargetPath, { recursive: true});
                } else {
                    throw new Error(`The source path is neither a file nor a directory: ${sourcePath}. Got module: ${JSON.stringify(module)}`);
                }
                break;
            }
            case 'string': {
                await fs.promises.writeFile(absoluteTargetPath, module.source.value);
                break;
            }
            default:
                throw new Error(`Module source type is neither 'string' or 'path'. This is probably an internal bug, please report it. Got: ${JSON.stringify(module)}`)
        }
    
        if (module.dependsOn) {
            for (const depModule of module.dependsOn) {
                await this.buildRecur(tmpDir, depModule);
            }
        }
    }

}