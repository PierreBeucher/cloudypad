import * as assert from 'assert'
import { LinodeStateParser } from '../../../../src/providers/linode/state'

describe('LinodeStateParser', function () {
    const parser = new LinodeStateParser()

    it('should set deleteInstanceServerOnStop to true when undefined', function () {
        // Create a dummy Linode state without deleteInstanceServerOnStop defined
        const rawState = {
            version: "1",
            name: "test-linode-instance",
            provision: {
                provider: "linode",
                input: {
                    region: "us-east",
                    instanceType: "g6-nanode-1",
                    rootDiskSizeGb: 50,
                    dataDiskSizeGb: 100,
                    watchdogEnabled: true,
                    ssh: {
                        privateKeyPath: "/path/to/key",
                        user: "ubuntu"
                    }
                    // deleteInstanceServerOnStop is intentionally not defined
                }
            },
            configuration: {
                configurator: "ansible",
                input: {
                    sunshine: {
                        enable: true,
                        username: "sunshine",
                        passwordBase64: "dGVzdA==",
                        imageTag: "latest",
                        imageRegistry: "registry.example.com",
                        maxBitrateKbps: 5000
                    },
                    autostop: {
                        enable: true,
                        timeoutSeconds: 300
                    },
                    locale: "en_US.UTF-8",
                    keyboard: {
                        layout: "us",
                        variant: "dvorak",
                        model: "pc105",
                        options: ""
                    }
                }
            }
        }

        const parsedState = parser.parse(rawState)
        
        // Verify that deleteInstanceServerOnStop was set to true
        assert.strictEqual(parsedState.provision.input.deleteInstanceServerOnStop, true)
    })

    it('should accept deleteInstanceServerOnStop when explicitly set to true', function () {
        const rawState = {
            version: "1",
            name: "test-linode-instance",
            provision: {
                provider: "linode",
                input: {
                    region: "us-east",
                    instanceType: "g6-nanode-1",
                    rootDiskSizeGb: 50,
                    dataDiskSizeGb: 100,
                    watchdogEnabled: true,
                    deleteInstanceServerOnStop: true, // Explicitly set
                    ssh: {
                        privateKeyPath: "/path/to/key",
                        user: "ubuntu"
                    }
                }
            },
            configuration: {
                configurator: "ansible",
                input: {
                    sunshine: {
                        enable: true,
                        username: "sunshine",
                        passwordBase64: "dGVzdA==",
                        imageTag: "latest",
                        imageRegistry: "registry.example.com",
                        maxBitrateKbps: 5000
                    },
                    autostop: {
                        enable: true,
                        timeoutSeconds: 300
                    },
                    locale: "en_US.UTF-8",
                    keyboard: {
                        layout: "us",
                        variant: "dvorak",
                        model: "pc105",
                        options: ""
                    }
                }
            }
        }

        const parsedState = parser.parse(rawState)
        assert.strictEqual(parsedState.provision.input.deleteInstanceServerOnStop, true)
    })
})

