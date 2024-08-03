import { fetchApiKeyFromEnvironment, PaperspaceClient } from '../../../src/providers/paperspace/client/client';
import * as assert from 'assert';

describe('PaperspaceClient', function () {
    let client: PaperspaceClient
    const machineName = "TestMachine"
    let machineId: string

    // global template for Ubuntu 22
    // List via https://api.paperspace.io/templates/getTemplates x-api-key: xxx
    const templateId = "t0nspur5"

    // Let Paperspace do its work before timing out
    this.timeout(180000); 
    
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

        const resp = await client.createMachine({
            diskSize: 50,
            machineType: "C2",
            name: machineName,
            region: "Europe (AMS1)",
            templateId: templateId,
            publicIpType: "static",
            startOnCreate: false,
        })

        console.info(JSON.stringify(resp))

        assert.equal(resp.name, machineName)
        machineId = resp.id
        console.info(`Created machine: ${machineId}`)

        // Machine created without starting
        await client.waitForMachineState(machineId, "off")
    });

    it('should get a machine by id', async () => {
        console.info(`Trying to get machine by id: ${machineId}`)

        const resp = await client.getMachine(machineId)
        assert.equal(resp.region, "Europe (AMS1)");
    });

    it('should list machines', async () => {
        console.info(`Trying to list machines`)

        const resp = await client.listMachines()
        assert.equal(resp[0].region, "Europe (AMS1)");
    });

    it('should get machine by name', async () => {
        console.info(`Trying to get machine by name: ${machineName}`)

        const resp = await client.getMachineByName(machineName)
        assert.equal(resp.name, machineName);
    });

    it('should start a machine', async () => {
        await client.startMachine(machineId);
        const res = await client.waitForMachineState(machineId, "ready", 10000, 48)
        assert.equal(res, true)

        const newState = await client.getMachine(machineId)
        assert.equal(newState.state, "ready")
    })

    it('should stop a machine', async () => {
        await client.stopMachine(machineId);
        const res = await client.waitForMachineState(machineId, "off")
        assert.equal(res, true)

        const newState = await client.getMachine(machineId)
        assert.equal(newState.state, "off")

    })

    it('should delete a machine', async () => {
        const resp = await client.deleteMachine(machineId);
        console.info(JSON.stringify(resp))
    });

});
