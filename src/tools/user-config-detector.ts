import { execFile, execFileSync } from "child_process"
import { getLogger } from "../log/utils"
import { readFileSync } from "fs"

/**
 * Keyboard configuration for Linux. 
 * See https://man.archlinux.org/man/xkeyboard-config.7#LAYOUTS
 */
export interface LinuxKeyboardConfiguration {
    /**
     * Layout eg "fr" or "us"
     */
    layout?: string

    /**
     * Model eg "apple" or "pc105"
     */
    model?: string

    /**
     * Variant eg "qwerty", "azerty" or "mac"
     */
    variant?: string

    /**
     * Options eg "ctrl:swap_lalt_lctl"
     */
    options?: string
}

export const FALLBACK_KEYBOARD_CONFIGURATION_LINUX: LinuxKeyboardConfiguration = {
    layout: 'en',
    variant: 'qwerty',
}

export const FALLBACK_KEYBOARD_CONFIGURATION_DARWIN: LinuxKeyboardConfiguration = {
    layout: 'en',
    model: 'apple',
    variant: 'mac',
}
/**
 * Locale used as fallback when no locale is detected
 */

export const FALLBACK_LOCALE = 'en_US.utf8'
/**
 * Detect local user configuration: keyboard layout, model, variant, options, locale
 * 
 */
export class UserConfigDetector {

    private readonly platform: string
    private readonly envVars: Record<string, string | undefined>

    /**
     * @param platform override platform detection. Defaults to this.platform. Override is for testing purposes.
     * @param envVarsOverride override environment variables. Defaults to process.env. Override is for testing purposes.
     */
    constructor(platform?: string, envVarsOverride?: Record<string, string>) {
        this.platform = platform ?? process.platform
        this.envVars = envVarsOverride ?? process.env
    }

    private readonly logger = getLogger(UserConfigDetector.name)

    private runCommand(command: string, args: string[]): string {
        this.logger.trace(`Running command: '${command} ${args.join(' ')}' (raw: ${command} ${JSON.stringify(args)})`)

        const stdout = execFileSync(command, args, {encoding: 'utf8'})
        return stdout.trim()
    }

    /**
     * Given a "locale" output such as 
     * 
     * """"
     * LANG=en_US.utf8
     * LC_CTYPE="en_US.utf8"
     * LC_NUMERIC=fr_FR.utf8
     * ...
     * """
     * 
     * Return the first locale found in the output
     * 
     * @param envString 
     * @returns 
     */
    private parseLocaleOutput(envString: string): string | undefined {
        const env = Object.fromEntries(
            envString.split('\n')
                .map(line => line.split('=')
                    .map(part => part.replace(/^"|"$/g, ''))
                )
        )
        return env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE
    }

    runDarwinDefault(): string {
        return this.runCommand('defaults', ['read', '-globalDomain', 'AppleLocale'])
    }

    runLocaleA(): string {
        return this.runCommand('locale', ['-a'])
    }

    runLocale(): string {
        return this.runCommand('locale', [])
    }

    runSetxkbmapQuery(): string {
        return this.runCommand("setxkbmap", ["-query"])
    }

    runLocalectlStatus(): string {
        return this.runCommand("localectl", ["status"])
    }
    
    readEtcDefaultKeyboard(): string {
        return readFileSync('/etc/default/keyboard', 'utf8')
    }

    /**
     * Return the first locale found in the environment variables
     * from LC_ALL, LANG, LANGUAGE, LC_MESSAGES
     * 
     * @param envVarsOverride optional override of the environment variables (for testing purposes)
     * @returns the first locale found in the environment variables, or undefined if none is found
     */
    public posixLocaleFromEnv(): { envVar: string, locale: string } | undefined {
        if(this.envVars.LC_ALL) {
            return { envVar: 'LC_ALL', locale: this.envVars.LC_ALL }
        } else if(this.envVars.LANG) {
            return { envVar: 'LANG', locale: this.envVars.LANG }
        } else if(this.envVars.LANGUAGE) {
            return { envVar: 'LANGUAGE', locale: this.envVars.LANGUAGE }
        } else if(this.envVars.LC_MESSAGES) {
            return { envVar: 'LC_MESSAGES', locale: this.envVars.LC_MESSAGES }
        }
    }

    /**
     * Return the system locale from the "locale" command on Linux and "defaults" command on macOS
     * 
     * @returns the system locale, or FALLBACK_LOCALE if the locale is not found
     */
    public posixLocaleFromCommand(): string | undefined {

        this.logger.debug(`Detecting system locale from command on platform: ${this.platform}`)

        if (this.platform === 'darwin') {

            const appleLocaleRaw = this.runDarwinDefault().trim()

            // transform locale to match POSIX locale format
            const posixLocale = `${appleLocaleRaw.replace("-", "_")}.utf8`

            this.logger.trace(`Parsed Apple localenve: ${posixLocale}`)

            return posixLocale

        } else if (this.platform === 'linux') {
            
            const localeOutputRaw = this.runLocale()
            
            this.logger.trace(`'locale' command output: """\n${localeOutputRaw}\n""" Parsing...`)

            const parsedLocale = this.parseLocaleOutput(localeOutputRaw)

            this.logger.trace(`Parsed 'locale' command output: ${parsedLocale}`)

            return parsedLocale ?? FALLBACK_LOCALE
        } else {
            this.logger.warn(`Couldn't detect locale on platform: ${this.platform}. Defaulting to ${FALLBACK_LOCALE}`)
            return FALLBACK_LOCALE
        }
    }

    /**
     * Detect system locale:
     * - First try using environment variables LC_ALL, LANG, LANGUAGE
     * - If not found, try using "locale" command
     * - Fallback to FALLBACK_LOCALE if no local found
     */
    public detectPosixLocale(): string {        
        try {
            this.logger.trace("Detecting system locale...")

            const envLocale = this.posixLocaleFromEnv()

            if (envLocale) {
                this.logger.debug(`Detected locale '${envLocale.locale}' from environment variables: ${envLocale.envVar}`)
                return envLocale.locale
            }

            const commandLocale = this.posixLocaleFromCommand()

            if (commandLocale) {
                this.logger.debug(`Detected locale from 'locale' command: ${commandLocale}`)
                return commandLocale
            }

            this.logger.warn(`Couldn't detect locale from environment variables or 'locale'command. Falling back to ${FALLBACK_LOCALE}`)

            return FALLBACK_LOCALE

        } catch (e) {
            this.logger.warn(`Error detecting locale. Falling back to ${FALLBACK_LOCALE}`, e)
            return FALLBACK_LOCALE
        }
    }

    public getKeyboardConfigurationFromSetxkbmap(): LinuxKeyboardConfiguration | undefined {
        let layout = undefined
        let model = undefined
        let variant = undefined
        let options = undefined

        try {
            this.logger.trace("Running 'setxkbmap -query' command")

            const lines = this.runSetxkbmapQuery().split('\n')

            this.logger.trace(`'setxkbmap -query' command output: """\n${lines.join('\n')}\n"""`)

            lines.forEach(line => {
                if (line.startsWith('layout:')) layout = line.replace('layout:', '').trim()
                if (line.startsWith('model:')) model = line.replace('model:', '').trim()
                if (line.startsWith('variant:')) variant = line.replace('variant:', '').trim()
                if (line.startsWith('options:')) options = line.replace('options:', '').trim()
            })

            return {
                layout,
                model,
                variant,
                options
            }

        } catch (e) {
            this.logger.debug("Couldn't detect keyboard configuration from 'setxkbmap -query'", e)
            return undefined
        }
    }

    public getKeyboardConfigurationFromLocalectl(): LinuxKeyboardConfiguration | undefined {
        let layout = undefined
        let model = undefined
        let variant = undefined
        let options = undefined

        try {

            const lines = this.runLocalectlStatus().split('\n')

            lines.forEach(line => {
                if (line.trim().startsWith('X11 Layout:')) layout = line.replace('X11 Layout:', '').trim()
                if (line.trim().startsWith('X11 Model:')) model = line.replace('X11 Model:', '').trim()
                if (line.trim().startsWith('X11 Variant:')) variant = line.replace('X11 Variant:', '').trim()
                if (line.trim().startsWith('X11 Options:')) options = line.replace('X11 Options:', '').trim()
            })

            return {
                layout,
                model,
                variant,
                options
            }

        } catch (e) {
            this.logger.debug("Couldn't detect keyboard configuration from 'localectl status'", e)
            return undefined
        }
    }

    public getKeyboardConfigurationFromEtcDefaultKeyboard(): LinuxKeyboardConfiguration | undefined {
        let layout = undefined
        let model = undefined
        let variant = undefined
        let options = undefined

        try {
            const lines = this.readEtcDefaultKeyboard().split('\n')

            lines.forEach(line => {
                if (line.startsWith('XKBLAYOUT=')) layout = line.replace('XKBLAYOUT=', '').replace(/"/g, '').trim()
                if (line.startsWith('XKBMODEL=')) model = line.replace('XKBMODEL=', '').replace(/"/g, '').trim()
                if (line.startsWith('XKBVARIANT=')) variant = line.replace('XKBVARIANT=', '').replace(/"/g, '').trim()
                if (line.startsWith('XKBOPTIONS=')) options = line.replace('XKBOPTIONS=', '').replace(/"/g, '').trim()
            })

            return {
                layout,
                model,
                variant,
                options
            }

        } catch (e) {
            this.logger.debug("Couldn't detect keyboard configuration from '/etc/default/keyboard'", e)
            return undefined
        }
    }

    /**
     * Detect keyboard configuration on Darwing / macOS and return Linux equivalent
     * 
     * Uses current locale to detect layout and try to use Mac model
     */
    public getKeyboardConfigurationFromDarwinEnvironment(): LinuxKeyboardConfiguration {
        // MacOS: detect layout using localectl
        const locale = this.detectPosixLocale() 

        // locale is in the format "fr_FR.utf8" or "en_US.utf8"
        // extract country code (first 2 characters)
        const layout = locale.substring(0, 2)

        const model = 'apple'

        // Always use "mac" for lack of a better way to properly detect variant
        const variant = 'mac'

        return {
            layout: layout,
            model: model,
            variant: variant,
            options: undefined
        }
    }

    /**
     * Try to detect host keyboard configuration and return Linux equivalent: layout, model, variant, option.
     * Designed to work from Linux and Darwin platforms.
     * 
     * @returns Linux keyboard configuration matching host
     */
    public detectKeyboardConfiguration(): LinuxKeyboardConfiguration {
        let layout = undefined
        let model = undefined
        let variant = undefined
        let options = undefined
    
        try {
            if (this.platform === 'linux') {

                if(process.env.XDG_SESSION_TYPE == 'wayland' && process.env.CLOUDYPAD_KEYBOARD_LAYOUT_AUTODETECT_SKIP_WAYLAND_WARNING != 'true') {
                    this.logger.warn(`Wayland session detected. Keyboard layout detection may not work properly. ` + 
                        `You may want to use --keyboard-layout, --keyboard-model, --keyboard-variant and --keyboard-options flags ` +
                        `to set keyboard options for your instance, or you can change layout directly on instance in keyboard settings.`)
                }

                // at least layout is needed to consider output valid

                const localectl = this.getKeyboardConfigurationFromLocalectl()
                if (localectl && localectl.layout) {
                    this.logger.debug(`Detected keyboard configuration from 'localectl status': ${JSON.stringify(localectl)}`)
                    return localectl
                }

                const xkbquery = this.getKeyboardConfigurationFromSetxkbmap()
                if (xkbquery && xkbquery.layout) {
                    this.logger.debug(`Detected keyboard configuration from 'setxkbmap -query': ${JSON.stringify(xkbquery)}`)
                    return xkbquery
                }

                const etcDefaultKeyboard = this.getKeyboardConfigurationFromEtcDefaultKeyboard()
                if (etcDefaultKeyboard && etcDefaultKeyboard.layout) {
                    this.logger.debug(`Detected keyboard configuration from '/etc/default/keyboard': ${JSON.stringify(etcDefaultKeyboard)}`)
                    return etcDefaultKeyboard
                }

                this.logger.warn(`Couldn't detect keyboard configuration on Linux. Falling back to: ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.layout} ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.variant}`)

                return FALLBACK_KEYBOARD_CONFIGURATION_LINUX
                
            } else if (this.platform === 'darwin') {
                try {
                    return this.getKeyboardConfigurationFromDarwinEnvironment()
                } catch (e) {
                    
                    this.logger.warn(`Couldn't detect keyboard configuration on Darwing/MacOS. Falling back to: ${FALLBACK_KEYBOARD_CONFIGURATION_DARWIN.layout} ${FALLBACK_KEYBOARD_CONFIGURATION_DARWIN.variant}`)

                    return FALLBACK_KEYBOARD_CONFIGURATION_DARWIN
                }
            } else {
                this.logger.warn(`Couldn't detect keyboard configuration on ${this.platform}. Falling back to: ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.layout} ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.variant}`)
                return FALLBACK_KEYBOARD_CONFIGURATION_LINUX
            }

        } catch (error) {
            this.logger.warn(`Couldn't detect keyboard configuration`, error)
            this.logger.warn(`Falling back to: ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.layout} ${FALLBACK_KEYBOARD_CONFIGURATION_LINUX.variant}`)
            return FALLBACK_KEYBOARD_CONFIGURATION_LINUX
        }
    }
}
