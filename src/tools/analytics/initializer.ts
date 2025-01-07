
import { confirm } from '@inquirer/prompts'
import { AnalyticsCollectionMethod, ConfigManager } from '../../core/config/manager'

export class AnalyticsInitializer {

    private configManager = ConfigManager.getInstance()
    
    private async promptPersonalDataCollectionApprovalAndSetAnalytics(): Promise<void>{

        // Skip prompt if no TTY to avoid failures
        if(!process.stdin.isTTY) {
            return
        }
        
        const approvePersonalDataCollection = await confirm({
            message: `Do you allow Cloudy Pad to collect anonymous personal usage data ? (such as your OS or localisation).\n` +
                `Data won't be used for targeted ads or sold to third parties. It will only be used internally to improve Cloudy Pad.\n`+
                `By accepting you'll help Cloudy Pad get better!`,
            default: true,
        })
        
        this.configManager.setAnalyticsCollectionMethod(approvePersonalDataCollection ? AnalyticsCollectionMethod.All : AnalyticsCollectionMethod.Technical)
    }

    async promptAnalyticsConsentUnlessAlreadyDone() {
        const config = this.configManager.load()

        if(!config.analytics.promptedPersonalDataCollectionApproval) {
            await this.promptPersonalDataCollectionApprovalAndSetAnalytics()
            this.configManager.setAnalyticsPromptedPersonalDataCollectionApproval(true)
        }
    }
}

