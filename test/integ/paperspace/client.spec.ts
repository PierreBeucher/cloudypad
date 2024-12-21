import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { fetchApiKeyFromEnvironment, PaperspaceClient } from '../../../src/providers/paperspace/client/client';
import * as assert from 'assert';

describe('PaperspaceClient', function () {
    let client: PaperspaceClient
    const machineName = "TestMachine"
    let machineId: string
    let publicIp: string
    const machineType = "C2" // no need for GPU for this test, use cheapest instance

    // global template for Ubuntu 22
    // List via https://api.paperspace.io/templates/getTemplates x-api-key: xxx
    const templateId = "t0nspur5"

    // Let Paperspace do its work before timing out after 15 min
    this.timeout(15*60*1000); 
    
    this.beforeAll(() => {
        try {
            const foundApiKeys = fetchApiKeyFromEnvironment()
            if(foundApiKeys.length == 0){
                throw new Error("No Paperspace API Key found.")
            } else if(foundApiKeys.length > 1){
                throw new Error("Founr more than one API ky in environment.")
            }

            console.info(JSON.stringify(foundApiKeys))

            client = new PaperspaceClient({name: "test", apiKey: foundApiKeys[0] })
        } catch(e){
            console.error("Couldn't find Paperspace API key config. This test requires an API key, or maybe fetchApiKeyFromEnvironment is broken.", e)
        }
        
    });

    it('should create a machine', async () => {

        // TODO does not show proper
        // try using C1 machine and watch fail
        // Seems to come from client buildAxiosError method

        const resp = await client.createMachine({
            diskSize: 50,
            machineType: machineType,
            name: machineName,
            region: "Europe (AMS1)",
            templateId: templateId,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            startOnCreate: false,
        })

        console.info(JSON.stringify(resp))

        assert.equal(resp.name, machineName)
        machineId = resp.id

        console.info(`Created machine: ${machineId}`)

        // Machine created without starting
        console.info(`Waiting for machine creation: ${machineId}`)
        await client.waitForMachineState(machineId, "off")

        // Machine should now have IP
        const postCreateMachine = await client.getMachine(machineId)
        assert.ok(postCreateMachine.publicIp)
        publicIp = postCreateMachine.publicIp
    })

    it('should get a machine by id', async () => {
        console.info(`Trying to get machine by id: ${machineId}`)

        const resp = await client.getMachine(machineId)
        assert.equal(resp.name, machineName);
    })

    it('should list machines', async () => {
        console.info(`Trying to list machines`)

        const resp = await client.listMachines()
        const foundMachine = resp.find( (m) => m.name == machineName)
        assert.equal(foundMachine?.name, machineName);
    })

    it('should get machine by name', async () => {
        console.info(`Trying to get machine by name: ${machineName}`)

        const resp = await client.getMachineByName(machineName)
        assert.equal(resp.name, machineName);
    })

    it('should list IPs and find machine IP', async () => {
        console.info(`Trying to list and get IP for machine: ${machineName}`)

        const publicIps = await client.listPublicIps()
        assert.ok(publicIps.some(i => i.ip == publicIp), `IP ${publicIp} not found in public IPs: ${publicIps}`)
        assert.ok(await client.publicIpExists(publicIp), `IP ${publicIp} should exist.`)

        const foundIp = await client.getPublicIp(publicIp)
        console.info(`Found IP: ${JSON.stringify(foundIp)}`)

        assert.equal(foundIp?.ip, publicIp)
    })


    // it('should start a machine', async () => {
    //     await client.startMachine(machineId);
    //     const res = await client.waitForMachineState(machineId, "ready", 10000, 48)
    //     assert.equal(res, true)

    //     const newState = await client.getMachine(machineId)
    //     assert.equal(newState.state, "ready")
    // })

    // it('should stop a machine', async () => {
    //     await client.stopMachine(machineId);
    //     const res = await client.waitForMachineState(machineId, "off")
    //     assert.equal(res, true)

    //     const newState = await client.getMachine(machineId)
    //     assert.equal(newState.state, "off")

    // })

    it('should delete a machine', async () => {
        const resp = await client.deleteMachine(machineId, true);
        console.info(JSON.stringify(resp))
    })

    it('should not find machine after delete', async () => {

        // Wait for machine to disappear
        const retryInterval = 5000; // ms
        const maxRetries = 10;
        let retries = 0;
        let machineExists = true;
        while (machineExists && retries < maxRetries) {
            machineExists = await client.machineExists(machineId);
            if (machineExists) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
            retries++;
        }

        assert.ok(!machineExists, `Machine ${machineId} still exist ${maxRetries*retryInterval}ms after deletion request`);
    })

    it('should not find public IP after delete', async () => {

        // Wait for IP to disappear
        const retryInterval = 5000; // ms
        const maxRetries = 10;
        let retries = 0;
        let publicIpExists = true;
        while (publicIpExists && retries < maxRetries) {
            publicIpExists = await client.publicIpExists(machineId);
            if (publicIpExists) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
            retries++;
        }

        assert.ok(!publicIpExists, `Public IP ${publicIp} still exist ${maxRetries*retryInterval}ms after deletion request`);
    })

});
