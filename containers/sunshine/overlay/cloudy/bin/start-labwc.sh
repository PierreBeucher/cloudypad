#!/usr/bin/env bash

set -e

#
# Start labwc Wayland compositor (wlroots) as the main desktop session
#
# - Headless backend provides the virtual display output (no real monitor
#   attached to the container). Output resolution is set at session start
#   (see below) and adjusted on Sunshine session start by
#   setup-sunshine-screen-mode.sh
# - libinput backend handles input devices, including virtual devices
#   created by Sunshine via /dev/uinput when a client connects
# - libseat session via seatd (no logind in container), user is granted
#   access to the seatd socket via "video" group (see setup-user.sh)
#
# X11 applications (Steam, Heroic, Lutris...) run via labwc-managed XWayland
#
# Desktop panel (waybar) and wallpaper (swaybg) are separate supervised
# services (see supervisord.conf), not children of the compositor
#

# Explicitly force seatd as libseat backend (no logind in container)
export LIBSEAT_BACKEND=seatd

# Pin wlroots backends: DRM (display output on GPU or vkms card) + libinput
# (input devices). Headless backend is added by labwc itself for virtual
# outputs when needed.
# Without the DRM pin, an available seat could make wlroots try other
# backends unexpectedly.
export WLR_BACKENDS=drm,libinput

# Sunshine virtual input devices only appear after a client connects:
# starting with zero input devices is fine
export WLR_LIBINPUT_NO_DEVICES=1

# Create the virtual display output at backend start when running headless
# (no DRM card with connectors, eg. NVIDIA datacenter GPUs). Skipped when
# WLR_DRM_DEVICES is set: the DRM card connector is the output.
# labwc's auto-created virtual output may otherwise end up disabled (eg.
# after a failed modeset during startup), leaving the compositor without
# outputs
if [ -z "$WLR_DRM_DEVICES" ]; then
    export WLR_HEADLESS_OUTPUTS=1
fi

# Session environment for spawned applications
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=labwc
export XDG_SESSION_DESKTOP=labwc

# NOTE: no wait-udev-availability.sh here: udevadm control --ping requires root
# (control socket is root-only) and labwc does not need udev before starting.
# Input devices created by Sunshine (uinput) are handled by udevd at runtime.

# Wait for seatd socket (libseat session used by compositor for input)
SEATD_SOCKET=/run/seatd.sock
echo "Waiting for seatd socket at $SEATD_SOCKET..."
for i in $(seq 1 30); do
    if [ -S "$SEATD_SOCKET" ]; then
        echo "seatd socket found"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "WARNING: seatd socket not found after 30 attempts, starting labwc anyway (input may not work)"
    fi
    sleep 1
done

# Keyboard layout from Cloudy Pad environment: wlroots compositors read
# XKB_DEFAULT_* environment variables (replaces former Xorg 00-keyboard.conf)
# Keyboard layout: must be a valid xkb symbols name (us, fr, de...).
# An invalid name (eg. "en") makes xkbcommon fail to compile the keymap,
# which crashes labwc at startup (NULL keymap deref in
# keybind_update_keycodes). Validate against xkeyboard-config symbols
# files and fall back to "us" if invalid.
XKB_DEFAULT_LAYOUT=${CLOUDYPAD_KEYBOARD_LAYOUT:-us}
if [ ! -f "/usr/share/X11/xkb/symbols/$XKB_DEFAULT_LAYOUT" ]; then
    echo "WARNING: keyboard layout '$XKB_DEFAULT_LAYOUT' is not a valid xkb layout (no symbols file in /usr/share/X11/xkb/symbols/), falling back to 'us'"
    XKB_DEFAULT_LAYOUT=us
fi
export XKB_DEFAULT_LAYOUT
if [ -n "$CLOUDYPAD_KEYBOARD_MODEL" ]; then
    export XKB_DEFAULT_MODEL=$CLOUDYPAD_KEYBOARD_MODEL
fi
if [ -n "$CLOUDYPAD_KEYBOARD_VARIANT" ]; then
    # Variant must be declared in the layout's symbols file ("us" has no
    # variant, eg. "qwerty" is NOT a valid us variant) otherwise keymap
    # compile fails and crashes labwc (same NULL keymap deref as invalid
    # layout)
    if grep -qE "^[[:space:]]*xkb_symbols[[:space:]]+\"$CLOUDYPAD_KEYBOARD_VARIANT\"" "/usr/share/X11/xkb/symbols/$XKB_DEFAULT_LAYOUT" 2>/dev/null; then
        export XKB_DEFAULT_VARIANT=$CLOUDYPAD_KEYBOARD_VARIANT
    else
        echo "WARNING: keyboard variant '$CLOUDYPAD_KEYBOARD_VARIANT' is not valid for layout '$XKB_DEFAULT_LAYOUT', ignoring it"
        unset XKB_DEFAULT_VARIANT
    fi
fi
if [ -n "$CLOUDYPAD_KEYBOARD_OPTIONS" ]; then
    export XKB_DEFAULT_OPTIONS=$CLOUDYPAD_KEYBOARD_OPTIONS
fi
echo "Keyboard layout: XKB_DEFAULT_LAYOUT=$XKB_DEFAULT_LAYOUT XKB_DEFAULT_MODEL=$XKB_DEFAULT_MODEL XKB_DEFAULT_VARIANT=$XKB_DEFAULT_VARIANT XKB_DEFAULT_OPTIONS=$XKB_DEFAULT_OPTIONS"

#
# Software rendering fallback for GPU-less environments (dev VMs, containers
# without GPU access)
#
# Mesa cannot drive some virtual GPUs (eg. VirtualBox VMSVGA/vmwgfx: driver
# removed from modern Mesa), making wlroots fall back to the pixman renderer
# which does not support the linux-dmabuf protocol Sunshine needs to capture.
#
# If a vkms (virtual KMS) card is available and no hardware GPU is present,
# use it as the DRM backend device: Mesa falls back to llvmpipe software
# rendering over GBM (vkms supports GBM buffer allocation), keeping DMA-BUF
# buffers usable for Sunshine capture.
#
# Note: vgem (virtual GEM) is NOT suitable: it is render-only and cannot
# allocate GBM buffers (gbm_bo_create fails).
#
# Real GPUs (NVIDIA, AMD, Intel) take precedence: no override is applied.
#

HARDWARE_GPU_FOUND=false
VKMS_CARD=""

for card_sys in /sys/class/drm/card[0-9]*; do
    node_name=$(basename $card_sys)
    # Skip connectors (card0-Virtual-1 style entries)
    [[ "$node_name" =~ ^card[0-9]+$ ]] || continue
    # Driver name via device/driver symlink; some virtual GPUs (vkms, vgem)
    # do not expose it: fall back to device modalias (eg. "platform:vkms")
    driver=$(basename $(readlink -f $card_sys/device/driver) 2>/dev/null || true)
    if [ -z "$driver" ] || [ "$driver" = "driver" ]; then
        modalias=$(cat $card_sys/device/modalias 2>/dev/null || echo "")
        case "$modalias" in
            platform:vgem) driver="vgem" ;;
            platform:vkms) driver="vkms" ;;
            pci:*) driver="pci" ;;
            *) driver="unknown" ;;
        esac
    fi
    # Whether this card exposes a connected output connector
    # (connector dirs look like card0-Virtual-1)
    has_output=false
    for connector in $card_sys/card[0-9]*-*; do
        [[ -f $connector/status ]] || continue
        case "$(cat $connector/status)" in connected) has_output=true ;; esac
    done
    echo "Detected card $node_name (driver: $driver, output: $has_output)"
    case "$driver" in
        nvidia|i915|xe|amdgpu|radeon)
            if [ "$has_output" = "true" ]; then
                HARDWARE_GPU_FOUND=true
            else
                # Hardware GPU without connector (eg. NVIDIA datacenter GPU):
                # the DRM backend cannot create an output from this card.
                # Track it as renderer-capable card: the compositor uses the
                # headless backend for output (virtual output created below
                # via WLR_HEADLESS_OUTPUTS) while Mesa renders with this GPU
                # over GBM/EGL, keeping hardware acceleration for both
                # rendering and Sunshine capture.
                HARDWARE_RENDERER_CARD="/dev/dri/$node_name"
            fi
            ;;
        vkms) VKMS_CARD="/dev/dri/$node_name" ;;
    esac
done

if [ "$HARDWARE_GPU_FOUND" = "true" ]; then
    echo "Hardware GPU detected, using auto renderer and backend selection"
else
    if [ -n "$HARDWARE_RENDERER_CARD" ]; then
        # Hardware GPU without connector (eg. NVIDIA datacenter GPU):
        # render with this GPU over GBM/EGL, create a headless virtual output
        # for the display (WLR_BACKENDS drm pin above cannot create an output
        # without connector: switch to the headless backend)
        echo "Hardware GPU without connector detected, using headless output with renderer card: $HARDWARE_RENDERER_CARD"
        export WLR_BACKENDS=headless,libinput
        export WLR_DRM_DEVICES=$HARDWARE_RENDERER_CARD
        # Headless virtual output is the display
        export WLR_HEADLESS_OUTPUTS=1
        unset WLR_RENDERER_ALLOW_SOFTWARE
        # The GPU render node may appear (and get udev-set permissions) shortly
        # after the card: renderer open would fail with EPERM until udevd has
        # applied mode/ownership. Wait for the render node to be usable by the
        # current user before starting the compositor (fails fast otherwise,
        # leaving supervisor BACKOFF while udevd settles)
        card_device=$(readlink -f /sys/class/drm/$(basename $HARDWARE_RENDERER_CARD)/device)
        RENDER_NODE=""
        for render_sys in /sys/class/drm/renderD*; do
            [[ -e $render_sys/device ]] || continue
            if [ "$(readlink -f $render_sys/device)" = "$card_device" ]; then
                RENDER_NODE="/dev/dri/$(basename $render_sys)"
                break
            fi
        done
        if [ -n "$RENDER_NODE" ]; then
            echo "Waiting for render node $RENDER_NODE to be readable..."
            for i in $(seq 1 60); do
                if [ -c "$RENDER_NODE" ] && head -c 0 "$RENDER_NODE" 2>/dev/null; then
                    echo "Render node $RENDER_NODE ready (attempt $i)"
                    break
                fi
                sleep 1
            done
        else
            echo "WARNING: no render node found for $HARDWARE_RENDERER_CARD, renderer may fail to initialize"
        fi
        # Record the DRM device for other components: Sunshine DMA-BUF import
        # (gbm device) must use the same card. Written as a Sunshine config
        # snippet consumed by start-sunshine.sh (adapter_name is honored by
        # Sunshine render device resolution, see resolve_render_device())
        mkdir -p $CLOUDYPAD_CONF_DIR/sunshine
        echo "adapter_name = $HARDWARE_RENDERER_CARD" > $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
        chmod 0644 $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
    elif [ -n "$VKMS_CARD" ]; then
        echo "No hardware GPU, using vkms virtual GPU with software rendering: $VKMS_CARD"
        # Use the vkms card as DRM backend device: its connector provides the
        # display output, Mesa renders with llvmpipe over GBM
        export WLR_DRM_DEVICES=$VKMS_CARD
        export WLR_RENDERER_ALLOW_SOFTWARE=1
        # Do not add an extra headless output: the vkms connector is the output
        unset WLR_HEADLESS_OUTPUTS
        # Record the DRM device for other components: Sunshine DMA-BUF import
        # (gbm device) must use the same card. Written as a Sunshine config
        # snippet consumed by start-sunshine.sh (adapter_name is honored by
        # Sunshine render device resolution, see resolve_render_device())
        mkdir -p $CLOUDYPAD_CONF_DIR/sunshine
        echo "adapter_name = $VKMS_CARD" > $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
        # Software encoder: hardware encoders (nvenc/vaapi/vulkan) are useless
        # without a real GPU, and the vulkan probe crashes on lavapipe (no
        # VK_EXT_physical_device_drm properties). libx264 was proven working
        # against vkms DMA-BUF imports
        echo "encoder = software" >> $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
        chmod 0644 $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
    else
        echo "WARNING: no usable DRM device (hardware GPU or vkms), compositor will use pixman renderer and Sunshine capture may not work"
        rm -f $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf
    fi
fi

# Apply initial screen resolution once the compositor is accepting clients.
# Background subshell: it must run while labwc is starting and re-runs on
# every compositor restart (supervisor restarts labwc on crash).
# NOTE: a stale socket from a previous compositor run may still exist: retry
# the resolution setup until the compositor actually answers.
(
    for i in $(seq 1 100); do
        if [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
            break
        fi
        sleep 0.2
    done
    export SUNSHINE_CLIENT_WIDTH=${CLOUDYPAD_SCREEN_INITIAL_WIDTH:-1920}
    export SUNSHINE_CLIENT_HEIGHT=${CLOUDYPAD_SCREEN_INITIAL_HEIGHT:-1080}
    export SUNSHINE_CLIENT_FPS=${CLOUDYPAD_SCREEN_INITIAL_FPS:-60}
    for i in $(seq 1 20); do
        if setup-sunshine-screen-mode.sh; then
            break
        fi
        echo "WARNING: failed to set initial screen resolution (attempt $i/20), retrying..."
        sleep 1
    done
) &

echo "Starting labwc compositor (config dir: $XDG_CONFIG_HOME/labwc, WAYLAND_DISPLAY=$WAYLAND_DISPLAY)"

exec labwc