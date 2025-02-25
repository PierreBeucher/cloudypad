#! /usr/bin/env node

//
// Cloudy Pad index 
//
// - Prepare CLI program
// - Load CLI config, initialize it if needed
// - Initialize analytics client if enabled
//

import { ConfigManager } from "../core/config/manager"
import { buildProgram, shutdownAnalytics, cleanupAndExit, handleErrorAnalytics, logFullError } from "./program"
import { AnalyticsInitializer } from "../tools/analytics/initializer"
import { AnalyticsManager } from "../tools/analytics/manager"

async function main(){
    try {
        ConfigManager.getInstance().init()
        await new AnalyticsInitializer().promptAnalyticsConsentUnlessAlreadyDone()

        const program = buildProgram()
        await program.parseAsync(process.argv)

        await AnalyticsManager.get().shutdown()
        
    } catch (e){
        // This is a generic catch-all error handler. It logs the full error and sends it to analytics.
        // Program parseAsync() may catch error earlier
        logFullError(e)

        console.error("Oops, something went wrong 😨 Full error is shown above.")
        console.error("")
        console.error("If you think this is a bug, please file an issue with full error: https://github.com/PierreBeucher/cloudypad/issues")

        handleErrorAnalytics(e)
        await cleanupAndExit(1)
    }
}

main().finally(async () => {
    await shutdownAnalytics()
})