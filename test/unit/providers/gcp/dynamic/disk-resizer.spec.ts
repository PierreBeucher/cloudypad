import * as assert from 'assert'
import sinon from 'sinon'
import { DiskResizerProvider } from '../../../../../src/providers/gcp/dynamic/disk-resizer'
import { GcpClient } from '../../../../../src/providers/gcp/sdk-client'

// Contract we want to test via public API (create/update):
// - If disk not found => create rejects
// - If requested < actual => create rejects (no shrink)
// - If requested == actual => create outs.appliedSizeGb === current; no resize
// - If requested > actual => create outs.appliedSizeGb === requested; resize called

describe('DiskResizerProvider (public API)', function () {
  const projectId = 'proj'
  const zone = 'europe-west1-b'
  const disk = 'cloudypad-max'

  let provider: DiskResizerProvider
  let sandbox: sinon.SinonSandbox
  let getStub: sinon.SinonStub<[string, string], Promise<number | undefined>>
  let resizeStub: sinon.SinonStub<[string, string, number], Promise<void>>

  beforeEach(function () {
    sandbox = sinon.createSandbox()
    provider = new DiskResizerProvider()
    getStub = sandbox.stub(GcpClient.prototype, 'getDiskSizeGb')
    resizeStub = sandbox.stub(GcpClient.prototype, 'resizeDisk').resolves()
  })

  afterEach(function () {
    sandbox.restore()
  })

  it('throws when disk is not found', async function () {
    getStub.resolves(undefined)
    await assert.rejects(
      provider.create({ projectId, zone, diskName: disk, sizeGb: 200 }),
      /not found/i
    )
  })

  it('throws when trying to shrink', async function () {
    getStub.resolves(300)
    await assert.rejects(
      provider.create({ projectId, zone, diskName: disk, sizeGb: 200 }),
      /cannot shrink/i
    )
  })

  it('returns current size when equal (no-op)', async function () {
    getStub.resolves(300)
    const res = await provider.create({ projectId, zone, diskName: disk, sizeGb: 300 })
    const outs = res.outs as { appliedSizeGb: number }
    assert.strictEqual(outs.appliedSizeGb, 300)
    assert.strictEqual(resizeStub.called, false)
  })

  it('resizes when requested > actual', async function () {
    getStub.resolves(300)
    const res = await provider.create({ projectId, zone, diskName: disk, sizeGb: 350 })
    const outs = res.outs as { appliedSizeGb: number }
    assert.strictEqual(outs.appliedSizeGb, 350)
    assert.strictEqual(resizeStub.calledOnce, true)
    assert.deepStrictEqual(resizeStub.firstCall.args, [zone, disk, 350])
  })
})
