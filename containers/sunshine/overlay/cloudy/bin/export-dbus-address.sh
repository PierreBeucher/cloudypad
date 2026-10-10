# A DBUS session is started by supervisor dbus-session service on container startup
# Try to export DBUS_SESSION_BUS_ADDRESS to Sunshine if it exists
# Wait a bit as starting services may race with dbus-session startup
# (non-fatal: some services like pipewire work without session bus)
DBUS_SESSION_ADDRESS_FILE="$XDG_RUNTIME_DIR/dbus-session-bus-address"

for i in $(seq 1 30); do
    if [ -f "$DBUS_SESSION_ADDRESS_FILE" ]; then
        break
    fi
    sleep 0.5
done

if [ -f "$DBUS_SESSION_ADDRESS_FILE" ]; then
    export DBUS_SESSION_BUS_ADDRESS=$(cat $DBUS_SESSION_ADDRESS_FILE)
    echo "Found DBUS session bus address file: $DBUS_SESSION_ADDRESS_FILE. Exporting DBUS_SESSION_BUS_ADDRESS='$DBUS_SESSION_BUS_ADDRESS'..."
else
    echo "WARNING: $DBUS_SESSION_ADDRESS_FILE does not exist after 15s. Can't set DBUS_SESSION_BUS_ADDRESS."
fi