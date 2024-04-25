import { NixOSModule } from "../interfaces.js"

export function authorizedKeys(user: string, keys: string[]) : NixOSModule {
    const nixConfig = `
        { lib, pkgs, ... }: {
    
        users.users.${user}.openssh.authorizedKeys.keys = [
            ${keys.map(k => `"${k}"`).join("\n")}
        ];
    }
    `

    return {
        content: nixConfig,
        name: "authorized-keys.nix"
    }
}
