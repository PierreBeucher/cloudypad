#!/usr/bin/env bash

#
# Setup an arbitrary screen modeline Sunshine
# - Generate mode with cvt for current context
# - Create mode and add it to current screen if needed
# - Set mode to current screen
#
# Ensuring virtual screen always respects requested client resolution

SCREEN_WIDTH=${SUNSHINE_CLIENT_WIDTH:-}
SCREEN_HEIGHT=${SUNSHINE_CLIENT_HEIGHT:-}
SCREEN_FPS=${SUNSHINE_CLIENT_FPS:-}

# Try to identify screen to use
# First try to use primary connected screen
# If not found, use the first connected screen
SCREEN_NAME=$(xrandr -q | grep " connected primary" | head -n1 | awk '{print $1}')

# If no primary screen is found, try to use first connected screen
if [[ -z "$SCREEN_NAME" ]]; then
  echo "No primary connected screen found. Using first connected screen."
  SCREEN_NAME=$(xrandr -q | grep " connected" | head -n1 | awk '{print $1}')
fi

echo "Setting up screen mode for screen '$SCREEN_NAME' with $SCREEN_WIDTH x $SCREEN_HEIGHT @ $SCREEN_FPS"

if [[ -z "$SCREEN_WIDTH" || -z "$SCREEN_HEIGHT" || -z "$SCREEN_FPS" ]]; then
  echo "Error: SCREEN_WIDTH, SCREEN_HEIGHT, and SCREEN_FPS must be set."
  exit 1
fi

# Generate modeline using cvt
# Output something like
# Modeline "WIDTHxHEIGHT_60.00"  1234  xxx xxx -hsync +vsync
# Extract "WIDTHxHEIGHT"  and "1234  xxx xxx -hsync +vsync" separately
MODELINE_RAW=$(cvt $SCREEN_WIDTH $SCREEN_HEIGHT $SCREEN_FPS | grep Modeline | sed 's/Modeline //')
MODELINE=${MODELINE_RAW##*\"} # Only keep everything after last double quote
MODE_NAME=$(echo $MODELINE_RAW | awk -F '"' '{print $2}' | sed 's/_.*//') # Only keep WIDTHxHEIGHT without _FPS

echo "Generated modeline '$MODE_NAME' for $SCREEN_WIDTH x $SCREEN_HEIGHT @ $SCREEN_FPS:"
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
xrandr --output $SCREEN_NAME --mode ${MODE_NAME} --refresh ${SCREEN_FPS}

if [ $? -eq 0 ]; then
  echo "Successfully applied mode '$MODE_NAME' to $SCREEN_NAME."
else
  echo "Failed to apply mode '$MODE_NAME' to $SCREEN_NAME."
fi
