import { describe, it, expect, beforeEach } from 'vitest';
// import { PaperspaceClient } from '../../src/lib/paperspace/PaperspaceClient';
import { PaperspaceClient } from '../../src/lib/paperspace/PaperspaceClient';
import * as fs from 'fs'

describe('PaperspaceClient', () => {
    let client: PaperspaceClient
    const machineName = "TestMachine"
    let machineId: string

    // global template for Ubuntu 22
    // List via https://api.paperspace.io/templates/getTemplates x-api-key: xxx
    const templateId = "t0nspur5"

    beforeEach(() => {
        const apiKey = fs.readFileSync("tmp/paperspace-apikey", "utf-8")
        client = new PaperspaceClient({ apiKey: apiKey });
    });

    it('should create a machine', async () => {

        const resp = await client.createMachine({
            diskSize: 50,
            machineType: "C2",
            name: machineName,
            region: "Europe (AMS1)",
            templateId: templateId,
            startOnCreate: false,
        })

        console.info(JSON.stringify(resp))

        expect(resp.name).toEqual(machineName)
        machineId = resp.id
        console.info(`Created machine: ${machineId}`)

        // Machine created without starting
        await client.waitForMachineState(machineId, "off")
    }, 60000);

    it('should get a machine by id', async () => {
        console.info(`Trying to get machine by id: ${machineId}`)

        const resp = await client.getMachine(machineId)
        expect(resp.region).toEqual("Europe (AMS1)");
    });

    it('should list machines', async () => {
        console.info(`Trying to list machines`)

        const resp = await client.listMachines()
        expect(resp[0].region).toEqual("Europe (AMS1)");
    });

    it('should get machine by name', async () => {
        console.info(`Trying to get machine by name: ${machineName}`)

        const resp = await client.getMachineByName(machineName)
        expect(resp.name).toEqual(machineName);
    });

    //   it('should update a machine', async () => {
    //     const machineId = 'machine123';
    //     const params = {
    //       name: 'Updated Name',
    //     };
    //     mockPut.mockResolvedValue({ data: 'Machine updated' });

    //     const response = await client.updateMachine(machineId, params);

    //     expect(mockPut).toHaveBeenCalledWith(`/machines/${machineId}`, params);
    //     expect(response).toEqual({ data: 'Machine updated' });
    //   });

    it('should start a machine', async () => {
        await client.startMachine(machineId);
        const res = await client.waitForMachineState(machineId, "ready", 10000, 48)
        expect(res).toEqual(true)

        const newState = await client.getMachine(machineId)
        expect(newState.state).toEqual("ready")
    }, 360000)

    it('should stop a machine', async () => {
        await client.stopMachine(machineId);
        const res = await client.waitForMachineState(machineId, "off")
        expect(res).toEqual(true)

        const newState = await client.getMachine(machineId)
        expect(newState.state).toEqual("off")

    }, 120000)

    it('should delete a machine', async () => {
        const resp = await client.deleteMachine(machineId);
        console.info(JSON.stringify(resp))
    });

});
