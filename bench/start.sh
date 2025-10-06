#!/bin/bash

# Start Xvfb (virtual display) in the background if HEADED_MODE is enabled
if [ "$ENABLE_XVFB" = "true" ]; then
    echo "Starting Xvfb for headed mode support..."
    Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
    export DISPLAY=:99
    sleep 2
    echo "Xvfb started on DISPLAY=:99"
fi

# Start the benchmark server
exec npm run server
