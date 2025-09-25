import * as assert from 'assert'
import sinon from 'sinon'
import { GcpCliCommandGenerator } from '../../../../src/providers/gcp/cli'
import { getUnitTestCoreConfig } from '../../utils'
import { Command } from 'commander'

// We test only the validation logic we added around disk size for update.
// Strategy:
//  - Stub providerClient.getInstanceState to return a state with known diskSize
//  - Provide smaller, equal, larger disk sizes via CLI parsing
//  - Ensure: smaller -> error thrown; equal -> info message; larger -> info resize message

describe('GCP update disk size validation', () => {
  const coreConfig = getUnitTestCoreConfig()
  let sandbox: sinon.SinonSandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  // Minimal fake state reflecting structure used in cli.ts
  interface MinimalState { name: string; provision: { input: { diskSize: number } } }
  const buildState = (diskSize: number): MinimalState => ({
    name: 'inst1',
    provision: { input: { diskSize } },
  })

  const buildCommand = () => {
    const gen = new GcpCliCommandGenerator({
      analytics: { sendEvent: sinon.stub() } as unknown as { sendEvent: (..._args: unknown[]) => void },
      coreConfig,
      baseProgram: new Command(),
    })
    return gen.buildUpdateCommand({ coreConfig })
  }

  it('should reject smaller disk size', async () => {
    const cmd = buildCommand()

    // Stub instance state retrieval on provider client prototype.
    // Import normally then stub constructor
    const providerModule = await import('../../../../src/providers/gcp/provider')
    interface FakeClient {
      getInstanceState: () => Promise<MinimalState>
      getInstanceUpdater: () => { updateStateOnly: () => Promise<void> }
      getInstanceManager: () => Promise<{ deploy: () => Promise<void> }>
    }
    const providerStateStub = sinon.stub(providerModule, 'GcpProviderClient').callsFake(function (this: FakeClient) {
      this.getInstanceState = async () => buildState(200)
      this.getInstanceUpdater = () => ({ updateStateOnly: async () => {} })
      this.getInstanceManager = async () => ({ deploy: async () => {} })
      return this
    })

    let caught: unknown
    try {
      await cmd.parseAsync(['node', 'cloudypad', '--name', 'inst1', '--disk-size', '100', '--yes'])
    } catch (e) { caught = e }

    providerStateStub.restore()
    assert.ok(caught, 'Expected error when shrinking disk')
    const err = caught as Error & { cause?: unknown }
    const msg = String(err.cause ?? err.message ?? err)
    assert.match(msg, /Shrinking is not supported/i, `Unexpected error message: ${msg}`)
  })

  it('should log info and skip when equal disk size', async () => {
    const cmd = buildCommand()
  const infoSpy = sandbox.spy(console, 'info')
    const providerModule = await import('../../../../src/providers/gcp/provider')
    const providerStateStub = sinon.stub(providerModule, 'GcpProviderClient').callsFake(function (this: FakeClient) {
      this.getInstanceState = async () => buildState(200)
      this.getInstanceUpdater = () => ({ updateStateOnly: async () => {} })
      this.getInstanceManager = async () => ({ deploy: async () => {} })
      return this
    })

  await cmd.parseAsync(['node', 'cloudypad', '--name', 'inst1', '--disk-size', '200', '--yes'])

    providerStateStub.restore()
  // sandbox restore handled in afterEach

    assert.ok(infoSpy.calledWithMatch(/Disk size unchanged/i), 'Expected message about identical disk size')
  })

  it('should log resize message when larger disk size', async () => {
    const cmd = buildCommand()
  const infoSpy = sandbox.spy(console, 'info')
    const providerModule = await import('../../../../src/providers/gcp/provider')
    const providerStateStub = sinon.stub(providerModule, 'GcpProviderClient').callsFake(function (this: FakeClient) {
      this.getInstanceState = async () => buildState(200)
      this.getInstanceUpdater = () => ({ updateStateOnly: async () => {} })
      this.getInstanceManager = async () => ({ deploy: async () => {} })
      return this
    })

    await cmd.parseAsync(['node', 'cloudypad', '--name', 'inst1', '--disk-size', '250', '--yes'])

    providerStateStub.restore()
  // sandbox restore handled in afterEach

    assert.ok(infoSpy.calledWithMatch(/Resizing disk from/i), 'Expected resize info message')
  })
})
