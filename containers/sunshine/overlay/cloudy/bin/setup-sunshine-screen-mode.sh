#!/usr/bin/env bash

#
# Set virtual display output resolution to the requested client resolution
# (Wayland / labwc path - replaces the former xrandr modeline flow:
# resolution is native to the compositor, no modeline generation needed)
#
# Ensuring virtual screen always respects requested client resolution.
# Called:
# - at session start by start-desktop-session.sh (initial resolution)
# - on each Sunshine session start by sunshine-app-startup.sh
#

# Desired screen resolution
DESIRED_SCREEN_WIDTH=${SUNSHINE_CLIENT_WIDTH:-1920}
DESIRED_SCREEN_HEIGHT=${SUNSHINE_CLIENT_HEIGHT:-1080}
DESIRED_SCREEN_FPS=${SUNSHINE_CLIENT_FPS:-60}

# Maximum screen resolution
# If set, will be used to adjust desired resolution while keeping aspect ratio
# Ignored if not set
MAX_SCREEN_WIDTH=${CLOUDYPAD_SCREEN_MAX_WIDTH}
MAX_SCREEN_HEIGHT=${CLOUDYPAD_SCREEN_MAX_HEIGHT}

# Adjust resolution to fit maximum screen resolution if set
if [[ -n "$MAX_SCREEN_WIDTH" && -n "$MAX_SCREEN_HEIGHT" ]]; then

  echo "Maximum screen resolution is $MAX_SCREEN_WIDTH x $MAX_SCREEN_HEIGHT"

  # Adjust resolution while maintaining aspect ratio
  if (( DESIRED_SCREEN_WIDTH > MAX_SCREEN_WIDTH || DESIRED_SCREEN_HEIGHT > MAX_SCREEN_HEIGHT )); then

      echo "Desired resolution $DESIRED_SCREEN_WIDTH x $DESIRED_SCREEN_HEIGHT is greater than maximum allowed resolution $MAX_SCREEN_WIDTH x $MAX_SCREEN_HEIGHT. Adjusting..."

      ASPECT_RATIO=$(echo "scale=10; $DESIRED_SCREEN_WIDTH / $DESIRED_SCREEN_HEIGHT" | bc -l)
      echo "Desired resolution aspect ratio: $ASPECT_RATIO"

      if (( DESIRED_SCREEN_WIDTH * MAX_SCREEN_HEIGHT > DESIRED_SCREEN_HEIGHT * MAX_SCREEN_WIDTH )); then
          FINAL_SCREEN_WIDTH=$MAX_SCREEN_WIDTH
          FINAL_SCREEN_HEIGHT=$(echo "$MAX_SCREEN_WIDTH / $ASPECT_RATIO" | bc)
      else
          FINAL_SCREEN_HEIGHT=$MAX_SCREEN_HEIGHT
          FINAL_SCREEN_WIDTH=$(echo "$MAX_SCREEN_HEIGHT * $ASPECT_RATIO" | bc)
      fi
      # Truncate fractional part (bc may output decimals)
      FINAL_SCREEN_WIDTH=${FINAL_SCREEN_WIDTH%.*}
      FINAL_SCREEN_HEIGHT=${FINAL_SCREEN_HEIGHT%.*}
  else
      echo "Desired resolution $DESIRED_SCREEN_WIDTH x $DESIRED_SCREEN_HEIGHT is within maximum allowed resolution $MAX_SCREEN_WIDTH x $MAX_SCREEN_HEIGHT. Using desired resolution."
      FINAL_SCREEN_WIDTH=$DESIRED_SCREEN_WIDTH
      FINAL_SCREEN_HEIGHT=$DESIRED_SCREEN_HEIGHT
  fi
else
  echo "No maximum screen resolution set. Using desired resolution $DESIRED_SCREEN_WIDTH x $DESIRED_SCREEN_HEIGHT as-is."
  FINAL_SCREEN_WIDTH=$DESIRED_SCREEN_WIDTH
  FINAL_SCREEN_HEIGHT=$DESIRED_SCREEN_HEIGHT
fi

if [[ -z "$FINAL_SCREEN_WIDTH" || -z "$FINAL_SCREEN_HEIGHT" || -z "$DESIRED_SCREEN_FPS" ]]; then
  echo "Error: FINAL_SCREEN_WIDTH, FINAL_SCREEN_HEIGHT, and DESIRED_SCREEN_FPS must be set."
  exit 1
fi

if [ -z "$WAYLAND_DISPLAY" ]; then
  echo "Error: WAYLAND_DISPLAY is not set, cannot adjust output resolution."
  exit 1
fi

# Detect the display output to resize
# wlr-randr lists each output on its own non-indented line, eg.
#   HEADLESS-1
#     Description: ...
#     Enabled: yes
#     ...
# Single virtual headless output expected: use first enabled output
OUTPUT_NAME=""
while IFS= read -r line; do
  # Non-indented lines are output names
  if [[ "$line" =~ ^[^[:space:]] ]]; then
    CANDIDATE=${line%% *}
    if wlr-randr | grep -A20 "^$CANDIDATE" | grep -q "Enabled: yes"; then
      OUTPUT_NAME=$CANDIDATE
      break
    fi
  fi
done <<< "$(wlr-randr)"

if [[ -z "$OUTPUT_NAME" ]]; then
  echo "Error: could not detect any enabled display output."
  exit 1
fi

echo "Setting display output '$OUTPUT_NAME' to $FINAL_SCREEN_WIDTH x $FINAL_SCREEN_HEIGHT @ $DESIRED_SCREEN_FPS"

wlr-randr --output $OUTPUT_NAME --custom-mode ${FINAL_SCREEN_WIDTH}x${FINAL_SCREEN_HEIGHT}@${DESIRED_SCREEN_FPS}

if [ $? -eq 0 ]; then
  echo "Successfully applied mode '${FINAL_SCREEN_WIDTH}x${FINAL_SCREEN_HEIGHT}@${DESIRED_SCREEN_FPS}' to output '$OUTPUT_NAME'."
else
  echo "Failed to apply mode to output '$OUTPUT_NAME'."
  exit 1
fi