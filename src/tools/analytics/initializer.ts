
import { confirm } from '@inquirer/prompts'
import { v4 as uuidv4 } from 'uuid'
import { ConfigManager } from '../../core/config/manager'

export class AnalyticsInitializer {

    async promptApproval(): Promise<boolean>{

        // Skip prompt if no TTY to avoid failures
        if(!process.stdin.isTTY) {
            return true
        }
        
        const approveAnalytics = await confirm({
            message: `Do you allow Cloudy Pad to collect anonymous usage data ? Data won't be used for targeted ads or sold to third parties. It will only be used internally to improve Cloudy Pad. By approving you'll help Cloudy Pad !`,
            default: true,
        })

        return approveAnalytics
    }

    /**
     * Prepare global configuration to enable PostHog analytics. Prompt user for approval if not already done. 
     */
    async prepareAnalyticsConfig() {
        const configManager = ConfigManager.getInstance()
        const config = configManager.load()
    
        if(!config.analytics.promptedApproval) {
            const enableAnalytics = await this.promptApproval()
    
            if(enableAnalytics){
                // Generate unique distinct if not already exists
                const distinctId = config.analytics.posthog?.distinctId ? config.analytics.posthog?.distinctId : uuidv4() 
                configManager.enableAnalyticsPosthHog({ distinctId: distinctId })
            } else {
                configManager.disableAnalytics()
            }
    
            configManager.updateAnalyticsPromptedApproval(true)
        }
    }
}

