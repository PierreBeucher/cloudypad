#!/usr/bin/env bash

#
# Setup an arbitrary screen modeline Sunshine
# - Generate mode with cvt for current context
# - Create mode and add it to current screen if needed
# - Set mode to current screen
#
# Ensuring virtual screen always respects requested client resolution

# Desired screen resolution
DESIRED_SCREEN_WIDTH=${SUNSHINE_CLIENT_WIDTH:-1920}
DESIRED_SCREEN_HEIGHT=${SUNSHINE_CLIENT_HEIGHT:-1080}
DESIRED_SCREEN_FPS=${SUNSHINE_CLIENT_FPS:-60}

# Maximum screen resolution
# If set, will be used to adjust desired resolution while keeping aspect ratio
# Ignored if not set
MAX_SCREEN_WIDTH=${CLOUDYPAD_SCREEN_MAX_WIDTH}
MAX_SCREEN_HEIGHT=${CLOUDYPAD_SCREEN_MAX_HEIGHT}

# Try to identify screen to use
# First try to use primary connected screen
# If not found, use the first connected screen
SCREEN_NAME=$(xrandr -q | grep " connected primary" | head -n1 | awk '{print $1}')

# If no primary screen is found, try to use first connected screen
if [[ -z "$SCREEN_NAME" ]]; then
  echo "No primary connected screen found. Using first connected screen."
  SCREEN_NAME=$(xrandr -q | grep " connected" | head -n1 | awk '{print $1}')
fi

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

echo "Setting up screen mode for screen '$SCREEN_NAME' with $FINAL_SCREEN_WIDTH x $FINAL_SCREEN_HEIGHT @ $DESIRED_SCREEN_FPS"

if [[ -z "$FINAL_SCREEN_WIDTH" || -z "$FINAL_SCREEN_HEIGHT" || -z "$DESIRED_SCREEN_FPS" ]]; then
  echo "Error: FINAL_SCREEN_WIDTH, FINAL_SCREEN_HEIGHT, and DESIRED_SCREEN_FPS must be set."
  exit 1
fi

# Generate modeline using cvt
# Output something like
# Modeline "WIDTHxHEIGHT_60.00"  1234  xxx xxx -hsync +vsync
# Extract "WIDTHxHEIGHT"  and "1234  xxx xxx -hsync +vsync" separately
MODELINE_RAW=$(cvt $FINAL_SCREEN_WIDTH $FINAL_SCREEN_HEIGHT $DESIRED_SCREEN_FPS | grep Modeline | sed 's/Modeline //')
MODELINE=${MODELINE_RAW##*\"} # Only keep everything after last double quote
MODE_NAME=$(echo $MODELINE_RAW | awk -F '"' '{print $2}' | sed 's/_.*//') # Only keep WIDTHxHEIGHT without _FPS

echo "Generated modeline '$MODE_NAME' for $FINAL_SCREEN_WIDTH x $FINAL_SCREEN_HEIGHT @ $DESIRED_SCREEN_FPS:"
echo "  $MODELINE"

# Create mode if needed
if xrandr | grep -q "$MODE_NAME"; then
  echo "Mode '$MODE_NAME' already exists. Skipping creation."
else
  echo "Creating new mode with name '$MODE_NAME' and modeline '$MODELINE'"

  xrandr --newmode "$MODE_NAME" $MODELINE

  if [ $? -eq 0 ]; then
    echo "Successfully created new mode '$MODE_NAME' with modeline '$MODELINE'."
  else
    echo "Failed to create new mode '$MODE_NAME' with modeline '$MODELINE'."
  fi
fi

# Try to find mode in screen existing mode
# Only add mode if it doesn't already exist
# Verbose function but more readable and maintainable than a complex sed command
XRANDR_OUTPUT=$(xrandr -q)

# Flag to start checking modes
check_modes=false
should_add_mode=true

# Loop through each line of xrandr output
while IFS= read -r line; do
  
  # Check if the line contains the screen name
  if echo "$line" | grep -q "^$SCREEN_NAME"; then
    check_modes=true
    continue
  fi

  # If we are in the mode checking section
  if $check_modes; then
    # Check if the line contains a resolution mode
    if echo "$line" | grep -q "^[[:space:]]*[0-9]\+x[0-9]\+"; then
      
      # Extract the resolution mode
      existing_mode=$(echo "$line" | awk '{print $1}')
      
      echo "Found existing mode: $existing_mode"
      if [ "$existing_mode" == "$MODE_NAME" ]; then
        should_add_mode=false
        break
      fi
    else
      # Stop checking if a non-resolution mode is found
      break
    fi
  fi
done <<< "$XRANDR_OUTPUT"

if $should_add_mode; then
  echo "Adding mode '$MODE_NAME' to $SCREEN_NAME"
  xrandr --addmode $SCREEN_NAME $MODE_NAME

  if [ $? -eq 0 ]; then
    echo "Successfully added mode '$MODE_NAME' to $SCREEN_NAME."
  else
    echo "Failed to add mode '$MODE_NAME' to $SCREEN_NAME."
  fi
else
  echo "Mode '$MODE_NAME' already exists in the list of modes for $SCREEN_NAME. Skipping addmode."
fi

echo "Setting mode '$MODE_NAME' to $SCREEN_NAME"

# Apply the new mode to the screen
xrandr --output $SCREEN_NAME --mode ${MODE_NAME} --refresh ${DESIRED_SCREEN_FPS}

if [ $? -eq 0 ]; then
  echo "Successfully applied mode '$MODE_NAME' to $SCREEN_NAME."
else
  echo "Failed to apply mode '$MODE_NAME' to $SCREEN_NAME."
fi
