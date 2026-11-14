# Linode RTX 4000 Ada game freeze: FFCP + x11 capture, fixed with NvFBC

Investigate why The Blood of Dawnwalker freezes on Linode g2 RTX 4000 Ada (but not Scaleway L4), find the trigger by live A/B testing, and fix it by enabling NvFBC capture on that GPU.

## Initial iteration

> Claude, you might help me. In '/home/pbeucher/git/cloudypad/core/game-report.md' is a report by another less powerful AI for Cloudy Pad on a Linode instance. It's about a Rise of the Dawnwalker, a game that is VERY SLOW to play on Cloudy Pad Linode instance deployed on this branch, but runs just fine on Scaleway. Also cosnider the work we did on this branch - it was a hard road to arrive ot something thatw orks.
>
> Now analyse this AI analysis: what do you think? Where may the issue be located at?
>
> Note: by "slow", I mean the game itself is very slow. Starting up is very slow, and even when things are moving - it's as if the CPU is overloaded (despite almost not being used), not like "video is slow" or "network is slow", but more like "my game is running on a single CPU" slow
>
> You can't run Linode or access it, you only have access to this report. You can also check internet, ProtonDB, user reports and such.
>
> What I want is your analysis of the situation, what may be wrong, and give me a plan to help solve the issue.

### Code changes

None (analysis only).

### Issues encountered

- The earlier report stopped at "threads parked in futex/poll" without resolving what they wait on, read "GPU 6%" as healthy, and blamed storage (but Scaleway sbs is also ~5k IOPS, so storage is not a Linode-vs-Scaleway differentiator).
- Ranked hypotheses: GPU completion / vblank / flip path on the passed-through RTX 4000 Ada (display engine already fragile on this branch: Xid 56, fliplock wedge), hypervisor CPU throttling (split-lock), Wine sync path, x11 capture contention, storage.

## Iteration 2

> instance is now running. I just started the game to reproduce the issue and my Moonlight session is active. You can now go to work: connect, analyse, identify, try to fix live (Linode API reboot only, no Cloudy Pad stop/start)...

### Code changes

None (live diagnosis).

### Issues encountered

- Host facts ruled out CPU-side causes: AMD EPYC 9474F (no split lock), kvm-clock, steal 0, kernel 5.15, esync active, wineserver idle, no network/disk activity during stall.
- Resolved what every thread waits on: wrote `tmp/perf/waits.py` (reads `/proc/<tid>/syscall`, decodes poll fd arrays via `/proc/<pid>/mem`, resolves fds). Showed vkd3d queue thread polling `/dev/nvidia0` (waiting GPU), swapchain thread idle (no presents), main thread in a no-timeout futex.
- Got a real Windows-side backtrace with `winedbg` from inside the container: it failed silently before because Proton's wineserver runs with esync - needs `WINEESYNC=1` (error `Server is running with WINEESYNC but this process is not`). Signature: `Dawnwalker -> sl.pcl -> sl.reflex -> nvapi64 -> d3d12core` (Streamline Reflex/latency path blocked) while the GPU is idle.
- Tried `VKD3D_DISABLE_EXTENSIONS=VK_NV_low_latency2` via Proton `user_settings.py` (persists on data disk, no container restart). Run looked healthy, but the user had also disabled DLSS via cloud save -> confounded.

## Iteration 3

> DLSS DLAA suspected (setting carried by cloud save between Scaleway and Linode)... stop/start the instance, run the game autonomously, A/B DLSS vs vkd3d fix

### Code changes

None.

### Issues encountered

- Game settings live in `RebelSettings.sav` (GVAS MapProperty<Str,Float>, Steam Cloud synced); wrote in-place float editor `tmp/perf/setsetting.py` (`Video_Upscaler_Technology=1.0` = DLSS on).
- Autonomous loop: launch via `steam steam://rungameid/3751260` in the container, sample with `run-test.sh` / `watch-game.sh` (game CPU, `strace -c` on `vkd3d-swapchain` as present-activity proxy, GPU util, read bytes), auto-capture waits + winedbg on stall.
- No stall reproduced without Moonlight, with or without the vkd3d change, DLSS on: the trigger needed something tied to the stream.
- A run "crashed" the VM: it was Cloudy Pad autostop (`shutdown -h` after 15 min without stream), then Linode Lassie rebooted. Stopped `cloudypad-autostop` live for testing.

## Iteration 4

> stop/start, enable advanced logging, I'll stream and reproduce

### Code changes

None.

### Issues encountered

- Reproduced with streaming. Xorg log showed session start applying `ForceFullCompositionPipeline=On` (`setup-sunshine-screen-mode.sh`, run by Sunshine prep-cmd on every app launch). FFCP persists until X restarts -> explains "stalls even with Sunshine stopped" in the old report and why autonomous runs (fresh X, never streamed) were clean.
- Sunshine state reset needed for pairing (removed `sunshine_state.json`, restarted Sunshine/container).
- Same-session A/B on datacenter driver 590: FFCP off -> runs; FFCP on -> freeze ~25s after launch.

## Iteration 5

> Is FFCP a symptom of a deeper root cause (EDID issue, datacenter driver)? Test display driver on a fresh instance (linode-display-driver), test FFCP live

### Code changes

None at this point (instance deployed by the user with an uncommitted detect-script change forcing `10de:27b2` to display driver).

### Issues encountered

- Display driver 595.99.02 (open module + GSP) freezes identically with FFCP on -> driver type/version is not the cause.
- FFCP toggled live in-game: on -> freeze within 8s; off while frozen -> recovers within ~30s, no Xid. Reversible, not a display-engine wedge (unlike the EDID issue).
- Scaleway also has FFCP on; difference identified: Scaleway L4 is in the NvFBC GPU list, RTX 4000 Ada falls to x11 capture.
- Live test with `CLOUDYPAD_SUNSHINE_CAPTURE=nvfbc` in compose: NvFBC works on the pro card, FFCP on, 38 min play, 0 stalls, reconnect OK. Trigger = FFCP + Sunshine x11 capture on this GPU.

## Iteration 6

> Split datacenter (2560x1600 capped) vs RTX 4000 GPUs, use nvidia-smi for NvFBC detection, keep lspci for driver detection, only validated models, keep FFCP and EDID; fix detect script comments; commit and push; run configure to validate

### Code changes

Added `nvidia_professional_gpu_models` (only `NVIDIA RTX 4000 Ada Generation`) getting NvFBC without the datacenter resolution cap, and corrected the RTX 4000 Ada device-ID comment in the driver detection script (commit `bcf5dc5`).

### Issues encountered

- `lspci` (Ubuntu 22.04 pci.ids) shows only `Device [10de:27b2]`, while `nvidia-smi` reports `NVIDIA RTX 4000 Ada Generation`: driver detection must stay device-ID based (`nvidia-smi` doesn't exist before driver install), NvFBC detection can use the `nvidia-smi` name. Verified `27b2` = RTX 4000 Ada and `27b0` = SFF via `nvidia-smi --query-gpu=name,pci.device_id` and the driver README appendix (`/usr/share/doc/NVIDIA_GLX-1.0/README.txt`).
- Validated the template by rendering it with Ansible locally for L4/T4/RTX 4000 Ada/GeForce/RTX 4000 SFF (`tmp/perf/render-test.sh`), then a real configure on `linode-display-driver`: detection `display`, compose re-rendered with `nvfbc` and no cap, Sunshine `Screencasting with NvFBC`.

## Iteration 7

> Session fails to start again after quitting a few times - inquire why; then stop and destroy the instance, update AI history

### Code changes

None.

### Issues encountered

- After a disconnect, NvFBC logged `Couldn't release NvFBC context from current thread`; next sessions started audio but never video -> `Initial Ping Timeout` -> `Hang detected! Session failed to terminate` -> Sunshine SIGTRAP. Same chain existed with x11 capture earlier (known Sunshine teardown bug); the `default-sink [auto_null]` error appears on every disconnect and is not the cause.
- Our healthcheck + autoheal made it worse: slow Sunshine restart failed 3 healthchecks (10s interval) and autoheal restarted the whole container, killing the game. Follow-up candidates: longer healthcheck grace, reproduce NvFBC teardown failure.
- Open follow-ups: other pro GPUs with display outputs (Paperspace Quadro RTX/RTX A-series) still use x11 + FFCP and may hit the same freeze (unvalidated); root cause of why FFCP + x11 capture blocks frame completion on this GPU is unexplained (candidates: open module/GSP, real display head with fake monitor, Linode host).
