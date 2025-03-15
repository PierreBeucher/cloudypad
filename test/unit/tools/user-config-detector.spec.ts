import * as assert from 'assert'
import { UserConfigDetector } from '../../../src/tools/user-config-detector'
import sinon from 'sinon';

describe('UserConfigDetector', () => {


    sinon.stub(UserConfigDetector.prototype, 'runDarwinDefault').returns('de-DE')
    
    sinon.stub(UserConfigDetector.prototype, 'runLocaleA').returns(`
C
C.utf8
en_US.utf8
fr_FR.utf8
de_DE.utf8
POSIX`)
    
    sinon.stub(UserConfigDetector.prototype, 'runLocale').returns(`
LANG=en_US.utf8
LC_CTYPE="en_US.utf8"
LC_NUMERIC=fr_FR.utf8
LC_TIME=fr_FR.utf8
LC_COLLATE="en_US.utf8"
LC_MONETARY=fr_FR.utf8
LC_MESSAGES="en_US.utf8"
LC_PAPER=fr_FR.utf8
LC_NAME=fr_FR.utf8
LC_ADDRESS=fr_FR.utf8
LC_TELEPHONE=fr_FR.utf8
LC_MEASUREMENT=fr_FR.utf8
LC_IDENTIFICATION=fr_FR.utf8
LC_ALL=`)

    sinon.stub(UserConfigDetector.prototype, 'runSetxkbmapQuery').returns(`
WARNING: Running setxkbmap against an Xwayland server
rules:      evdev
model:      pc105
layout:     fr
variant:    qwerty
options:    terminate:ctrl_alt_bksp`)

    sinon.stub(UserConfigDetector.prototype, 'runLocalectlStatus').returns(`
System Locale: LANG=en_US.utf8
               LC_NUMERIC=fr_FR.utf8
               LC_TIME=fr_FR.utf8
               LC_MONETARY=fr_FR.utf8
               LC_PAPER=fr_FR.utf8
               LC_NAME=fr_FR.utf8
               LC_ADDRESS=fr_FR.utf8
               LC_TELEPHONE=fr_FR.utf8
               LC_MEASUREMENT=fr_FR.utf8
               LC_IDENTIFICATION=fr_FR.utf8
    VC Keymap: (unset)                     
   X11 Layout: fr
    X11 Model: pc104
  X11 Variant: azerty
  X11 Options: terminate:ctrl_alt_bksp
`)
    
    sinon.stub(UserConfigDetector.prototype, 'readEtcDefaultKeyboard').returns(`
# KEYBOARD CONFIGURATION FILE

# Consult the keyboard(5) manual page.

XKBMODEL="pc105"
XKBLAYOUT="fr"
XKBVARIANT="qwerty"
XKBOPTIONS=""

BACKSPACE="guess"`)

    // main methods

    it('should detect keyboard configuration (force Linux platform)', async () => {
        const detector = new UserConfigDetector('linux')

        const keyboard = detector.detectKeyboardConfiguration()

        assert.deepEqual(keyboard, {
            layout: 'fr',
            model: 'pc104',
            variant: 'azerty',
            options: 'terminate:ctrl_alt_bksp'
        })
    })

    it('should detect keyboard configuration (force Darwin platform)', async () => {
        const detector = new UserConfigDetector('darwin')

        const keyboard = detector.detectKeyboardConfiguration()

        assert.deepEqual(keyboard, {
            layout: 'en',
            model: 'apple',
            variant: 'mac',
            options: undefined
        })
    })

    it('should detect system locale', async () => {
        const detector = new UserConfigDetector()

        const locale = detector.detectPosixLocale()

        assert.strictEqual(locale, 'en_US.utf8')
    })

    // Utils methods 

    it('should detect system locale from command (Linux platform)', async () => {
        const detector = new UserConfigDetector('linux')

        const locale = detector.posixLocaleFromCommand()

        assert.strictEqual(locale, 'en_US.utf8')
    })

    it('should detect system locale from command (Darwin platform)', async () => {
        const detector = new UserConfigDetector('darwin')

        const locale = detector.posixLocaleFromCommand()

        assert.strictEqual(locale, 'de_DE.utf8')
    })

    it('should detect system locale from environment variables', async () => {
        const detector = new UserConfigDetector()

        const locale1 = detector.posixLocaleFromEnv({ LC_ALL: 'en_US.utf8', LANG: 'fr_FR.utf8', LANGUAGE: 'fr_FR.utf8', LC_MESSAGES: 'fr_FR.utf8' })
        assert.deepEqual(locale1, { envVar: 'LC_ALL', locale: 'en_US.utf8' })

        const locale2 = detector.posixLocaleFromEnv({ LANG: 'en_US.utf8', LANGUAGE: 'fr_FR.utf8', LC_MESSAGES: 'fr_FR.utf8' })
        assert.deepEqual(locale2, { envVar: 'LANG', locale: 'en_US.utf8' })

        const locale3 = detector.posixLocaleFromEnv({ LANGUAGE: 'en_US.utf8', LC_MESSAGES: 'fr_FR.utf8' })
        assert.deepEqual(locale3, { envVar: 'LANGUAGE', locale: 'en_US.utf8' })

        const locale4 = detector.posixLocaleFromEnv({ LC_MESSAGES: 'en_US.utf8' })
        assert.deepEqual(locale4, { envVar: 'LC_MESSAGES', locale: 'en_US.utf8' })

        const locale5 = detector.posixLocaleFromEnv({})
        assert.strictEqual(locale5, undefined)
    })

    it('should detect keyboard configuration from setxkbmap', async () => {
        const detector = new UserConfigDetector()

        const keyboard = detector.getKeyboardConfigurationFromSetxkbmap()

        assert.deepEqual(keyboard, {
            layout: 'fr',
            model: 'pc105',
            variant: 'qwerty',
            options: 'terminate:ctrl_alt_bksp'
        })
    })

    it('should detect keyboard configuration from localectl', async () => {
        const detector = new UserConfigDetector()

        const keyboard = detector.getKeyboardConfigurationFromLocalectl()

        assert.deepEqual(keyboard, {
            layout: 'fr',
            model: 'pc104',
            variant: 'azerty',
            options: 'terminate:ctrl_alt_bksp'
        })
    })

    it('should detect keyboard configuration from etc/default/keyboard', async () => {
        const detector = new UserConfigDetector()

        const keyboard = detector.getKeyboardConfigurationFromEtcDefaultKeyboard()

        assert.deepEqual(keyboard, {
            layout: 'fr',
            model: 'pc105',
            variant: 'qwerty',
            options: ''
        })
    })

    it('should detect keyboard configuration from Darwin environment', async () => {
        const detector = new UserConfigDetector()

        const keyboard = detector.getKeyboardConfigurationFromDarwinEnvironment()

        assert.deepEqual(keyboard, {
            layout: 'en',
            model: 'apple',
            variant: 'mac',
            options: undefined
        })
    })

})
