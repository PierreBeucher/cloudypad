import * as assert from 'assert';
import { costAlertCliArgsIntoConfig } from '../../../src/core/cli/prompter';

describe('costAlertCliArgsIntoConfig', () => {

    it('should transform true into cost alert config', async () => {

        const args = {
            costAlert: true,
            costLimit: 100,
            costNotificationEmail: 'test@test.com',
        }

        const config = costAlertCliArgsIntoConfig(args)

        assert.deepEqual(config, {
            limit: 100,
            notificationEmail: 'test@test.com',
        }, "Enabling cost alert with limit and notification email should return cost alert config")

        const args2 = {
            costAlert: true,
        }

        const config2 = costAlertCliArgsIntoConfig(args2)

        assert.deepEqual(config2, {
            limit: undefined,
            notificationEmail: undefined,
        }, "Enabling cost alert without limit and notification email should return undefined cost options")
    })

    it('should transform CLI args into cost alert config', async () => {

        const args = {
            costAlert: false, // false has priority over costLimit and costNotificationEmail
            costLimit: 999,
            costNotificationEmail: 'test@test.com',
        }

        const config = costAlertCliArgsIntoConfig(args)

        assert.deepEqual(config, null)

        const args2 = {
            costAlert: false
        }

        const config2 = costAlertCliArgsIntoConfig(args2)

        assert.deepEqual(config2, null)
    })

})
    


