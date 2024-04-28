/**
 * A NixOS module representation
 */
export interface NixOSModule {
    /**
     * Module name, where <name>.nix file will be written. 
     */
    name: string,

    /**
     * Concrete Nix module content
     */
    content?: string,

    /**
     * Concrete Nix module path
     */
    path?: string,

    /**
     * Other modules on which this module depends. 
     */
    modules: NixOSModule[]
}

/**
 * A directory containing one or more modules.
 */
export interface NixOSModuleDirectory {
    /**
     * Module name. Must be a .nix file under path/
     */
    name: string,

    /**
     * Path to module directory
     */
    path: string,
}