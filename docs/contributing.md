# Contributing and development guide

## Implement a new Box

Boxes should manage underlying infrastructure and configuration idempotently. When implementing a Box, consider:

- Build upon existing Box. For example, `WolfManagerBox` builds on `ReplicatedNixOSManagerBox` to deploy a Nix instance and configure Wolf.
- Build upon existing low-level clients and providers:
  - Prefer [Pulumi](../src/lib/infra/pulumi/pulumi-client.ts) client to manage a Pulumi stack for provisioning if possible
  - If no Pulumi Cloud or package exists for your provisioning target, consider writing your own client like [Paperspace client](../src/lib/paperspace/PaperspaceClient.ts). Such a client should have CRUD operations so that Box can be managed idempotently. 

## Define your Box kind

Decide on a Box kind, following a Kubernetes-like convention such as `somegroup.subgroup.Name`, eg. for wolf it's `gaming.Wolf.Manager`

**`BoxProvisioner`, `ManagerBox` or `BoxConfigurator` ?**

- A `ManagerBox` manages the entire lifecycle of a Box: provision and configuration.
- A `BoxProvisioner` and `BoxConfigurator` manages only the provisioning or configuration respectively
- For example, `WolfManagerBox` manages both provisioning of a GPU instance and configuration of Wolf on instance. It builds (indirectly) upon `NixBoxConfigurator` and a `ReplicatedEC2ManagerBox`

For the remaining on this guide your Box kind will be `crafteo.NewBox.Manager`

## Create a Box class

Create your Box class under `src/boxes`. For `crafteo.NewBox.Manager`, create a file `src/boxes/example/newManagerBox.ts` based on this template and adapt to your needs:
  
```ts
// Your box type.
export const BOX_KIND_EXAMPLE_NEWBOX = "crafteo.NewBox.Manager"

export const NewManagerBoxSpecZ = z.object({
    // ...
}).strict()

// The *SchemaZ will allow parsing of Box YAML config.
// It always extends BoxSchemaBaseZ with a "spec" field
// taking your Box arguments
export const NewManagerBoxSchemaZ = BoxSchemaBaseZ.extend({
    spec: NewManagerBoxSpecZ
})

// Extrapolate interfaces from Zod definitions
export type NewManagerBoxSpec = z.infer<typeof NewManagerBoxSpecZ>
export type NewManagerBoxSchema = z.infer<typeof NewManagerBoxSchemaZ>

// Box class arguments
// probably reusing partially or totally above interfaces
export interface NewManagerBoxArgs {
  // ...
}

// Your Box implementation
// Here is defined box Lifecycle from creation to destroy
export class NewManagerBox extends BoxBase implements ManagerBox {

    // This static field is required on all Box
    // It points to a function reading a Box YAML spec into a concret NewManagerBox type
    // See below for an example
    static parseSpec = parseNewManagerBoxSpec

    readonly args: NewManagerBoxArgs

    constructor(name: string, args: NewManagerBoxArgs) {
        super({ name: name, kind: BOX_KIND_EXAMPLE_NEWBOX})
        this.args = args
    }

    // deploy should do both provision and configuration
    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    // Provision your Box by deploying infrastructure
    // eg. Run Pulumi
    // Must be idempotent
    public async provision() {
        // ...
    }

    // Configure your Box by configuring and installing everything required
    // eg. run NixOS rebuild
    // Must be idempotent
    public async configure() {
        // ...
    }

    // Manage Box lifecycle: start/stop/restart and destroy
    public async destroy() {
        // ...
    }

    public async preview() {
        // ...
    }

    public async get() {
        // ...
    }

    public async stop() {
        // ...
    }

    public async start() {
        // ...
    }

    public async restart() {
        // ...
    }

    // Add any other functions required
}

// Parse a raw (unknown) config using Zod into a concrete NewManagerBox instance
export async function parseNewManagerBoxSpec(rawConfig: unknown) : Promise<NewManagerBox> {

    // Parse raw config with Zod, giving us type safety other unkwown config
    const config = await NewManagerBoxSpecZ.parseAsync(rawConfig)

    // Prepare Box arguments as needed
    const args: NewManagerBoxArgs = {
      // ...
    }

    // Return our Box
    return new NewManagerBox(config.name, args)
}
```

Our Box is now ready, we just need to add it to `KIND_TO_MANAGER_MAP` in `src/lib/core.ts` so it can be used:

```ts
export const KIND_TO_MANAGER_MAP = new Map<string, (s: unknown) => Promise<ManagerBox>>([
    // ... other boxes
    [BOX_KIND_EXAMPLE_NEWBOX, NewManagerBox.parseNewManagerBoxSpec],
])
```

Now when reading a YAML file, `kind: crafteo.NewBox.Manager` will produce a `NewManagerBox` instance to manage our Box. Core boilerplate implementaton take cares of the rest.

Last, create an example under `examples` such as `examples/crafteo/newbox.yml`:

```yaml
name: my-awesome-box
kind: crafteo.NewBox.Manager
spec: 
  foo: bar # Our box spec...
```

Which can be used with `cloudybox deploy box examples/crafteo/newbox.yml`