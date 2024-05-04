import { NixOSModule } from "../modules.js"

export function authorizedKeys(user: string, keys: string[]) : NixOSModule {
    const nixConfig = `
        { lib, pkgs, ... }: {
    
        users.users.${user}.openssh.authorizedKeys.keys = [
            ${keys.map(k => `"${k}"`).join("\n")}
        ];
    }
    `

    return {
        sourceContent: nixConfig,
        name: "authorized-keys.nix",
        dependsOn: [],
    }
}
