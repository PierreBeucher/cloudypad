
import { confirm } from '@inquirer/prompts'
import { ConfigManager } from '../../core/config/manager'

export class AnalyticsInitializer {

    private configManager = ConfigManager.getInstance()
    
    private async promptApprovalAndSetAnalytics(): Promise<void>{

        // Skip prompt if no TTY to avoid failures
        if(!process.stdin.isTTY) {
            return
        }
        
        const approveAnalytics = await confirm({
            message: `Do you allow Cloudy Pad to collect anonymous usage data ? Data won't be used for targeted ads or sold to third parties. It will only be used internally to improve Cloudy Pad. By approving you'll help Cloudy Pad !`,
            default: true,
        })

        this.configManager.setAnalyticsEnabled(approveAnalytics)
    }

    async promptAnalyticsConsentUnlessAlreadyDone() {
        const config = this.configManager.load()

        if(!config.analytics.promptedApproval) {
            await this.promptApprovalAndSetAnalytics()
            this.configManager.updateAnalyticsPromptedApproval(true)
        }
    }
}

