import { NoOpAnalyticsClient } from "../../../src/tools/analytics/client"
import { AnalyticsManager } from "../../../src/tools/analytics/manager"
import * as assert from 'assert'

describe('Check dummy analytics client used for test', () => {
    it('should use dummy analytics client', () => {
        const client = AnalyticsManager.get()

        assert.equal(client instanceof NoOpAnalyticsClient, true)
    })
})